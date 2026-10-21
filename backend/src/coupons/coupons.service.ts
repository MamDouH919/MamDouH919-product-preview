import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { Coupon, CouponType } from './schemas/coupon.schema';
import { CouponUsage } from './schemas/coupon-usage.schema';
import { CreateCouponDto, QueryCouponsDto, UpdateCouponDto } from './dto/coupon.dto';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { MoneyError, parseDecimal, parseMoney, percentOf } from '../common/money/money';

/** Why a code can't be used right now — the storefront turns these into messages. */
export type CouponError =
  | 'not_found'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'customer_limit'
  | 'min_subtotal';

export type CouponCheck =
  | { ok: true; coupon: Coupon; discountMinor: number }
  | { ok: false; error: CouponError; minSubtotal?: number };

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(CouponUsage.name) private usageModel: Model<CouponUsage>,
  ) {}

  // ── Applying ────────────────────────────────────────────────────────────────

  /**
   * Whether `code` applies to a basket worth `subtotalMinor`, and for how
   * much. Without a customer the per-customer limit can't be known yet, so the
   * cart page may show a discount that checkout later refuses — checkout
   * always runs this again with the customer, then claims the use in
   * `redeem`, which is what actually decides a race.
   */
  async check(
    code: string,
    subtotalMinor: number,
    customerId?: string,
    session?: ClientSession,
  ): Promise<CouponCheck> {
    const coupon = await this.couponModel
      .findOne({ code: code.trim().toUpperCase(), isActive: true })
      .session(session ?? null)
      .exec();
    if (!coupon) return { ok: false, error: 'not_found' };

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: 'not_started' };
    if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: 'expired' };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return { ok: false, error: 'usage_limit' };
    }
    if (coupon.minSubtotal != null && subtotalMinor < parseMoney(coupon.minSubtotal)) {
      return { ok: false, error: 'min_subtotal', minSubtotal: coupon.minSubtotal };
    }

    if (customerId && coupon.perCustomerLimit != null) {
      const used = await this.usesBy(coupon, new Types.ObjectId(customerId), session);
      if (used >= coupon.perCustomerLimit) return { ok: false, error: 'customer_limit' };
    }

    return { ok: true, coupon, discountMinor: this.discountFor(coupon, subtotalMinor) };
  }

  /**
   * Claims one use for an order, inside its transaction. Two writes decide it:
   * the coupon's `usedCount` (only while a use is left) and, when there is a
   * per-customer limit, that customer's usage document (only while under the
   * limit). Concurrent checkouts write the same documents, so only one of two
   * racing for the last use commits. Returns null when claimed, or which
   * limit this checkout lost to. `orderId` is the order claiming it — already
   * written in this transaction, so it must not count as a past use.
   */
  async redeem(
    coupon: Coupon,
    customerId: Types.ObjectId,
    orderId: Types.ObjectId,
    session: ClientSession,
  ): Promise<CouponError | null> {
    const claimed = await this.couponModel
      .findOneAndUpdate(
        {
          _id: coupon._id,
          isActive: true,
          $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
        },
        { $inc: { usedCount: 1 } },
        { session },
      )
      .exec();
    if (!claimed) return 'usage_limit';

    if (coupon.perCustomerLimit != null) {
      // Orders placed before usage documents existed still count: the first
      // claim starts the count from them.
      await this.usageModel
        .updateOne(
          { coupon: coupon._id, customer: customerId },
          { $setOnInsert: { count: await this.legacyUses(coupon.code, customerId, session, orderId) } },
          { upsert: true, session },
        )
        .exec();
      const counted = await this.usageModel
        .findOneAndUpdate(
          { coupon: coupon._id, customer: customerId, count: { $lt: coupon.perCustomerLimit } },
          { $inc: { count: 1 } },
          { session },
        )
        .exec();
      if (!counted) return 'customer_limit';
    }
    return null;
  }

  /**
   * Gives a use back — the order holding it was cancelled. Finds the coupon by
   * id when the order recorded one, so a later coupon reusing the code isn't
   * the one credited; older orders only know the code.
   */
  async release(
    applied: { id?: Types.ObjectId; code: string },
    customerId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    const coupon = await this.couponModel
      .findOneAndUpdate(
        { ...(applied.id ? { _id: applied.id } : { code: applied.code }), usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      )
      .exec();
    if (coupon) {
      await this.usageModel
        .updateOne({ coupon: coupon._id, customer: customerId, count: { $gt: 0 } }, { $inc: { count: -1 } }, { session })
        .exec();
    }
  }

  /** Live uses of a coupon by a customer: their usage document, or their orders before one existed. */
  private async usesBy(coupon: Coupon, customerId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const usage = await this.usageModel
      .findOne({ coupon: coupon._id, customer: customerId })
      .session(session ?? null)
      .lean()
      .exec();
    return usage ? usage.count : this.legacyUses(coupon.code, customerId, session);
  }

  private legacyUses(
    code: string,
    customerId: Types.ObjectId,
    session?: ClientSession,
    exceptOrder?: Types.ObjectId,
  ): Promise<number> {
    return this.orderModel
      .countDocuments({
        customer: customerId,
        'coupon.code': code,
        status: { $ne: OrderStatus.CANCELLED },
        ...(exceptOrder ? { _id: { $ne: exceptOrder } } : {}),
      })
      .session(session ?? null)
      .exec();
  }

  /** Percentage (rounded half up) or fixed, capped, and never more than the subtotal. */
  private discountFor(coupon: Coupon, subtotalMinor: number): number {
    const raw =
      coupon.type === CouponType.PERCENTAGE ? percentOf(subtotalMinor, coupon.value) : parseMoney(coupon.value);
    const capped = coupon.maxDiscount != null ? Math.min(raw, parseMoney(coupon.maxDiscount)) : raw;
    return Math.min(capped, subtotalMinor);
  }

  /**
   * Amounts must be whole piastres; a percentage may carry up to 4 decimals.
   * Null clears an optional limit, so only values that are present are parsed.
   * Messages start with the field name, like class-validator's, so the form can
   * show each one under its field.
   */
  private assertAmounts(dto: Partial<CreateCouponDto>, type: CouponType | undefined): void {
    const check = (field: keyof CreateCouponDto, parse: () => unknown) => {
      try {
        parse();
      } catch (error) {
        if (error instanceof MoneyError) throw new BadRequestException([`${field}: ${error.message}`]);
        throw error;
      }
    };
    const { value, minSubtotal, maxDiscount } = dto;
    if (value != null) {
      check('value', () =>
        type === CouponType.PERCENTAGE ? parseDecimal(value, 4, 'percentage') : parseMoney(value),
      );
    }
    if (minSubtotal != null) check('minSubtotal', () => parseMoney(minSubtotal));
    if (maxDiscount != null) check('maxDiscount', () => parseMoney(maxDiscount));
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto): Promise<Coupon> {
    this.assertAmounts(dto, dto.type);
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
    this.assertAmounts(dto, dto.type ?? (await this.findOne(id)).type);
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
