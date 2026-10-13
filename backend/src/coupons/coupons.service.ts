import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Coupon, CouponType } from './schemas/coupon.schema';
import { CreateCouponDto, QueryCouponsDto, UpdateCouponDto } from './dto/coupon.dto';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';

/** Why a code can't be used right now — the storefront turns these into messages. */
export type CouponError =
  | 'not_found'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'customer_limit'
  | 'min_subtotal';

export type CouponCheck =
  | { ok: true; coupon: Coupon; discount: number }
  | { ok: false; error: CouponError; minSubtotal?: number };

/** Money is kept to two decimals so 10% of 33.33 doesn't become 3.3330000001. */
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) {}

  // ── Applying ────────────────────────────────────────────────────────────────

  /**
   * Whether `code` applies to a basket worth `subtotal`, and for how much.
   * Without a customer the per-customer limit can't be known yet, so the cart
   * page may show a discount that checkout later refuses — checkout always
   * runs this again with the customer.
   */
  async check(code: string, subtotal: number, customerId?: string): Promise<CouponCheck> {
    const coupon = await this.couponModel
      .findOne({ code: code.trim().toUpperCase(), isActive: true })
      .exec();
    if (!coupon) return { ok: false, error: 'not_found' };

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: 'not_started' };
    if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: 'expired' };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return { ok: false, error: 'usage_limit' };
    }
    if (coupon.minSubtotal != null && subtotal < coupon.minSubtotal) {
      return { ok: false, error: 'min_subtotal', minSubtotal: coupon.minSubtotal };
    }

    if (customerId && coupon.perCustomerLimit != null) {
      const used = await this.orderModel
        .countDocuments({
          customer: new Types.ObjectId(customerId),
          'coupon.code': coupon.code,
          status: { $ne: OrderStatus.CANCELLED },
        })
        .exec();
      if (used >= coupon.perCustomerLimit) return { ok: false, error: 'customer_limit' };
    }

    return { ok: true, coupon, discount: this.discountFor(coupon, subtotal) };
  }

  /**
   * Claims one use. Conditional on there being a use left, so two checkouts
   * racing for the last redemption can't both get it. Returns false if it lost.
   */
  async redeem(couponId: Types.ObjectId): Promise<boolean> {
    const updated = await this.couponModel
      .findOneAndUpdate(
        {
          _id: couponId,
          isActive: true,
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
        { $inc: { usedCount: 1 } },
      )
      .exec();
    return !!updated;
  }

  /** Gives a use back — the order that held it was cancelled or never completed. */
  async release(code: string): Promise<void> {
    await this.couponModel
      .updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
      .exec();
  }

  private discountFor(coupon: Coupon, subtotal: number): number {
    const raw =
      coupon.type === CouponType.PERCENTAGE
        ? (subtotal * coupon.value) / 100
        : coupon.value;
    const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
    return round2(Math.min(capped, subtotal));
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto): Promise<Coupon> {
    await this.assertCodeFree(dto.code);
    return this.couponModel.create(dto);
  }

  async findAll(query: QueryCouponsDto): Promise<Coupon[]> {
    const filter: QueryFilter<Coupon> = {};
    if (query.search) {
      filter.code = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    return this.couponModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Coupon> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Coupon not found');
    const coupon = await this.couponModel.findById(id).exec();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    if (dto.code) await this.assertCodeFree(dto.code, id);
    // `usedCount` isn't in the DTO, so an edit can never reset redemptions.
    const coupon = await this.couponModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after', runValidators: true })
      .exec();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  /** Orders keep their own copy of the code, so deleting a coupon rewrites no history. */
  async remove(id: string): Promise<Coupon> {
    const coupon = await this.couponModel.findByIdAndDelete(id).exec();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  private async assertCodeFree(code: string, exceptId?: string): Promise<void> {
    const existing = await this.couponModel.findOne({ code: code.toUpperCase() }).exec();
    if (existing && existing._id!.toString() !== exceptId) {
      throw new ConflictException(`A coupon with code "${code.toUpperCase()}" already exists.`);
    }
  }
}
