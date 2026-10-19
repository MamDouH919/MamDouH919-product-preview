import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { Customer, SavedCartItem } from '../customers/schemas/customer.schema';
import { Product } from '../products/schemas/product.schema';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { SaveCartDto } from './dto/cart.dto';

/** A saved line as the storefront cart holds it — shaped like the frontend's `CartItem`. */
export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  name: LocalizedField;
  variantLabel?: string;
  image?: string;
  slug: string;
  price?: number;
}

const OPT_OUT_TOKEN_TYPE = 'cart-reminders-opt-out';

/** Same lines in the same order — a re-save that changes nothing. */
const sameItems = (a: SavedCartItem[] = [], b: SavedCartItem[] = []) =>
  a.length === b.length &&
  a.every(
    (item, i) =>
      item.product.equals(b[i].product) &&
      String(item.variantId ?? '') === String(b[i].variantId ?? '') &&
      item.quantity === b[i].quantity,
  );

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly jwtService: JwtService,
  ) {}

  /** The saved basket with what's needed to show it, minus anything no longer for sale. */
  async getCart(customerId: string): Promise<{ items: CartLine[] }> {
    const customer = await this.customerModel.findById(customerId).select('+cart').lean().exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return { items: await this.describe(customer.cart?.items ?? []) };
  }

  /**
   * Mirrors the browser's basket. Only an actual change moves `updatedAt` —
   * the browser re-sends on every visit, and that mustn't re-arm a reminder
   * for a cart nobody has touched.
   */
  async saveCart(customerId: string, dto: SaveCartDto): Promise<{ saved: boolean }> {
    const customer = await this.customerModel.findById(customerId).select('+cart').exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const items: SavedCartItem[] = dto.items.map((item) => ({
      product: new Types.ObjectId(item.productId),
      variantId: item.variantId ? new Types.ObjectId(item.variantId) : undefined,
      quantity: item.quantity,
    }));

    if (!items.length) {
      if (customer.cart) await this.customerModel.updateOne({ _id: customer._id }, { $unset: { cart: 1 } }).exec();
      return { saved: true };
    }

    if (sameItems(customer.cart?.items, items)) {
      if (dto.locale && dto.locale !== customer.cart?.locale) {
        await this.customerModel.updateOne({ _id: customer._id }, { $set: { 'cart.locale': dto.locale } }).exec();
      }
      return { saved: false };
    }

    await this.customerModel
      .updateOne(
        { _id: customer._id },
        // `remindedAt` survives: being older than the new `updatedAt` is what makes a reminder due again.
        { $set: { 'cart.items': items, 'cart.locale': dto.locale, 'cart.updatedAt': new Date() } },
      )
      .exec();
    return { saved: true };
  }

  /**
   * Names, images and current prices for saved lines. Hidden or deleted
   * products and vanished variants drop out silently, the same way the
   * wishlist handles them.
   */
  async describe(items: SavedCartItem[]): Promise<CartLine[]> {
    if (!items.length) return [];
    const products = await this.productModel
      .find({ _id: { $in: items.map((i) => i.product) }, isActive: true })
      .select('name slug images price variants')
      .lean()
      .exec();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    return items.flatMap((item): CartLine[] => {
      const product = byId.get(String(item.product));
      if (!product) return [];
      const variant = item.variantId
        ? product.variants?.find((v) => String(v._id) === String(item.variantId))
        : undefined;
      if (item.variantId && !variant) return [];
      return [
        {
          productId: String(product._id),
          variantId: variant ? String(variant._id) : undefined,
          quantity: item.quantity,
          name: product.name,
          variantLabel: variant?.label,
          image: product.images?.[0],
          slug: product.slug,
          price: variant?.price ?? product.price,
        },
      ];
    });
  }

  /** The secret in a reminder's "stop these emails" link. Pinned to the tenant, like session tokens. */
  optOutToken(customerId: string, host: string): string {
    return this.jwtService.sign({ type: OPT_OUT_TOKEN_TYPE, customerId, tenant: host }, { expiresIn: '90d' });
  }

  async optOut(token: string, host: string): Promise<{ ok: true }> {
    let payload: { type?: string; customerId?: string; tenant?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('This link is invalid or has expired');
    }
    if (payload.type !== OPT_OUT_TOKEN_TYPE || payload.tenant !== host || !payload.customerId) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    await this.customerModel.updateOne({ _id: payload.customerId }, { $set: { cartReminders: false } }).exec();
    return { ok: true };
  }
}
