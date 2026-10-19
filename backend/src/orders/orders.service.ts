import { toCsv } from '../common/helpers/csv';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { Order, OrderItem } from './schemas/order.schema';
import { Counter } from './schemas/counter.schema';
import { Product } from '../products/schemas/product.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { AdjustStockDto } from '../inventory/dto/adjust-stock.dto';
import { CustomersService } from '../customers/customers.service';
import { Customer } from '../customers/schemas/customer.schema';
import { CustomerAuthService } from '../customer-auth/customer-auth.service';
import { CouponError, CouponsService } from '../coupons/coupons.service';
import { PriceListService } from '../price-list/price-list.service';
import { AddressFields } from '../customers/schemas/customer.schema';
import { OrderNotificationsService } from './order-notifications.service';
import {
  ORDER_TRANSITIONS,
  OrderStatus,
  PaymentMethod,
} from './enums/order-status.enum';
import {
  CreateGuestOrderDto,
  ExportOrdersDto,
  CreateOrderDto,
  OrderItemInputDto,
  QueryOrdersDto,
} from './dto/order.dto';

/** Why a basket line cannot be bought as it stands. */
export type QuoteIssue = 'unavailable' | 'no_price' | 'insufficient_stock';

/** One basket line priced against the live catalogue. */
export interface QuoteLine {
  productId: string;
  variantId?: string;
  name?: LocalizedField;
  variantLabel?: string;
  sku?: string;
  image?: string;
  slug?: string;
  unitPrice?: number;
  quantity: number;
  lineTotal: number;
  /** Units that can be sold right now; null when the line is not stock-limited. */
  available: number | null;
  issue?: QuoteIssue;
}

export interface Quote {
  items: QuoteLine[];
  subtotal: number;
  discount: number;
  /** The coupon that was applied, when one was asked for and it applies. */
  coupon?: { code: string; type: string; value: number };
  /** Why the requested coupon doesn't apply. Doesn't make the quote invalid. */
  couponError?: { code: CouponError; minSubtotal?: number };
  /**
   * `pending` until a subzone is given, then whether the store delivers there.
   * `shippingFee` is 0 unless this is `available`.
   */
  delivery: 'pending' | 'available' | 'unavailable';
  shippingFee: number;
  total: number;
  currency?: LocalizedField;
  /** True when every line can be ordered exactly as requested. */
  valid: boolean;
}

const COUPON_MESSAGES: Record<CouponError, string> = {
  not_found: 'This coupon code is not valid.',
  not_started: 'This coupon is not active yet.',
  expired: 'This coupon has expired.',
  usage_limit: 'This coupon has been fully used.',
  customer_limit: 'You have already used this coupon.',
  min_subtotal: 'Your order is below the minimum for this coupon.',
};

/**
 * Where a guest order's customer stands, which decides what its confirmation
 * page offers: `claimable` — this order created the record, so its token
 * holder may set a password right there; `guest` — an older guest record, which
 * can only be activated through an emailed link; `registered` — the email
 * already has an account, so the shopper should just sign in.
 */
export type GuestAccountStatus = 'claimable' | 'guest' | 'registered';

/** What placing an order needs beyond the basket, whoever is placing it. */
type PlaceOrderInput = Pick<
  CreateOrderDto,
  'items' | 'couponCode' | 'paymentMethod' | 'notes' | 'locale'
>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A priced line plus what placing it will do to stock. */
interface ResolvedLine extends QuoteLine {
  tracksStock: boolean;
}

const ORDER_COUNTER = 'order';
/** Most orders one CSV export will hold. */
const EXPORT_LIMIT = 20_000;
/** Order numbers start here so the first order isn't "#1". */
const ORDER_NUMBER_BASE = 1000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    private readonly inventoryService: InventoryService,
    private readonly customersService: CustomersService,
    private readonly customerAuthService: CustomerAuthService,
    private readonly couponsService: CouponsService,
    private readonly priceListService: PriceListService,
    private readonly notifications: OrderNotificationsService,
  ) {}

  // ── Pricing ─────────────────────────────────────────────────────────────────

  /**
   * Prices a basket against the catalogue as it is right now. The cart page
   * calls this to show real prices and flag problems before checkout, and
   * placing an order runs the same check — the client never supplies a price.
   */
  async quote(items: OrderItemInputDto[], couponCode?: string, subZoneId?: string): Promise<Quote> {
    const lines = await this.resolveLines(items);
    const { currency } = await this.getCheckoutSettings();
    const delivery = subZoneId ? await this.priceListService.resolve(subZoneId) : undefined;
    const shippingFee = delivery?.price ?? 0;

    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const valid = lines.every((line) => !line.issue);

    let discount = 0;
    let coupon: Quote['coupon'];
    let couponError: Quote['couponError'];
    if (couponCode?.trim()) {
      const check = await this.couponsService.check(couponCode, subtotal);
      if (check.ok) {
        discount = check.discount;
        coupon = { code: check.coupon.code, type: check.coupon.type, value: check.coupon.value };
      } else {
        couponError = { code: check.error, minSubtotal: check.minSubtotal };
      }
    }

    return {
      items: lines.map(({ tracksStock, ...line }) => line),
      subtotal,
      discount,
      coupon,
      couponError,
      delivery: delivery === undefined ? 'pending' : delivery ? 'available' : 'unavailable',
      shippingFee,
      total: round2(subtotal - discount + shippingFee),
      currency,
      valid,
    };
  }

  // ── Placing an order ────────────────────────────────────────────────────────

  async create(customerId: string, dto: CreateOrderDto, host: string): Promise<Order> {
    const customer = await this.customersService.getProfile(customerId);
    // The customer guard only checks the token, which stays valid after an
    // admin blocks the account — so check here too.
    if (!customer.isActive) {
      throw new ForbiddenException('This account is blocked from placing orders.');
    }

    const address = await this.customersService.getAddress(customerId, dto.addressId);

    return this.place(customer, address, dto, host);
  }

  /**
   * Checkout without signing in, Shopify style. The email links the order to
   * a customer — a new guest record built from the checkout details, or the
   * existing one for that email — and the order gets a secret token, so the
   * confirmation page and emails can show it without a session.
   */
  async createGuest(
    dto: CreateGuestOrderDto,
    host: string,
  ): Promise<{ order: Order; token: string; account: GuestAccountStatus }> {
    // Checked before a customer record exists, so a refused area leaves nothing behind.
    const { subZoneId, ...rest } = dto.shippingAddress;
    const address: AddressFields = {
      ...rest,
      ...(await this.customersService.deliveryLocation(subZoneId)),
    };
    const { customer, created } = await this.customersService.findOrCreateForCheckout(
      dto.email,
      address,
    );
    if (!customer.isActive) {
      throw new ForbiddenException('This account is blocked from placing orders.');
    }

    const token = nanoid(32);
    let order: Order;
    try {
      order = await this.place(customer, address, dto, host, {
        guestToken: token,
        canClaimAccount: created,
      });
    } catch (error) {
      // Don't leave a customer behind for an order that never happened —
      // unless a concurrent checkout with the same email got one through.
      if (created && !(await this.orderModel.exists({ customer: customer._id }))) {
        await this.customersService.removeGuest(customer._id as Types.ObjectId);
      }
      throw error;
    }

    return { order, token, account: this.accountStatus(customer, order) };
  }

  /**
   * Order status for someone who knows the order number and the email or phone
   * it was placed with. Deliberately a narrower view than the token page: no
   * street, no phone and no guest token — the token can also claim the
   * account, and an order number plus an email is not proof of owning it.
   * Every mismatch reads the same, so the form can't confirm which part was right.
   */
  async track(orderNumber: number, contact: string) {
    const notFound = new NotFoundException('No order matches those details');
    const order = await this.orderModel
      .findOne({ orderNumber })
      .populate<{ customer: Customer }>('customer', 'email')
      .lean()
      .exec();
    if (!order) throw notFound;

    const given = contact.trim().toLowerCase();
    const matches = given.includes('@')
      ? given === order.customer?.email?.toLowerCase()
      : this.samePhone(given, order.shippingAddress.phone);
    if (!matches) throw notFound;

    const a = order.shippingAddress;
    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: (order as unknown as { createdAt: Date }).createdAt,
      statusHistory: order.statusHistory.map(({ status, note, at }) => ({ status, note, at })),
      items: order.items.map(({ name, variantLabel, image, slug, quantity, unitPrice, lineTotal }) => ({
        name,
        variantLabel,
        image,
        slug,
        quantity,
        unitPrice,
        lineTotal,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      // Where it's going in broad strokes only.
      delivery: { zoneName: a.zoneName, subZoneName: a.subZoneName, city: a.city },
      recipient: a.fullName.trim().split(/\s+/)[0],
    };
  }

  /** "+20 100 123 4567" and "01001234567" are the same phone: compare the last nine digits. */
  private samePhone(given: string, stored?: string): boolean {
    const a = given.replace(/\D/g, '');
    const b = (stored ?? '').replace(/\D/g, '');
    return a.length >= 8 && b.length >= 8 && a.slice(-9) === b.slice(-9);
  }

  /** A guest order, for whoever holds its token. */
  async findGuestOrder(
    orderId: string,
    token: string,
  ): Promise<Record<string, unknown> & { account: GuestAccountStatus }> {
    const order = await this.findByGuestToken(orderId, token);
    const customer = await this.customersService.getProfile(order.customer.toString());
    return { ...order.toObject(), account: this.accountStatus(customer, order) };
  }

  /**
   * Turns a guest order's customer into a real account. When this order
   * created the record, its token holder sets a password and is signed in on
   * the spot. Otherwise the record predates them, so all they get is an
   * activation email to the address on file.
   */
  async claimGuestAccount(
    orderId: string,
    token: string,
    password: string | undefined,
    host: string,
  ) {
    const order = await this.findByGuestToken(orderId, token);
    const customer = await this.customersService.getProfile(order.customer.toString());

    if (!customer.isGuest) {
      throw new BadRequestException({
        message: 'An account already exists for this email. Please sign in.',
        code: 'registered',
      });
    }
    if (!customer.isActive) {
      throw new ForbiddenException('This account has been disabled');
    }

    if (order.canClaimAccount) {
      if (!password) throw new BadRequestException('password must be at least 6 characters');
      const activated = await this.customersService.activateGuest(
        customer._id as Types.ObjectId,
        await bcrypt.hash(password, 10),
      );
      if (!activated) {
        throw new BadRequestException({
          message: 'An account already exists for this email. Please sign in.',
          code: 'registered',
        });
      }
      await this.orderModel.updateOne({ _id: order._id }, { $set: { canClaimAccount: false } }).exec();
      return { session: await this.customerAuthService.createSession(activated, host) };
    }

    await this.customerAuthService.sendActivationEmail(customer, host, order.locale);
    return { activationSent: true };
  }

  private accountStatus(customer: Customer, order: Order): GuestAccountStatus {
    if (!customer.isGuest) return 'registered';
    return order.canClaimAccount ? 'claimable' : 'guest';
  }

  private async findByGuestToken(orderId: string, token: string): Promise<Order> {
    if (!Types.ObjectId.isValid(orderId) || !token) throw new NotFoundException('Order not found');
    const order = await this.orderModel
      .findOne({ _id: orderId, guestToken: token })
      .select('-statusHistory.by')
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Prices the basket again, writes the order, claims the coupon and takes the
   * stock — undoing everything if any step loses a race. Shared by signed-in
   * and guest checkout; only who it's for and where it ships differ.
   */
  private async place(
    customer: Customer,
    address: AddressFields,
    dto: PlaceOrderInput,
    host: string,
    guest?: { guestToken: string; canClaimAccount: boolean },
  ): Promise<Order> {
    const customerId = (customer._id as Types.ObjectId).toString();

    const lines = await this.resolveLines(dto.items);
    const problems = lines.filter((line) => line.issue);
    if (problems.length) {
      throw new BadRequestException({
        message: 'Some items in your cart can no longer be ordered as they are.',
        issues: problems.map(({ tracksStock, ...line }) => line),
      });
    }

    const settings = await this.getCheckoutSettings();
    const { currency } = settings;
    // Priced again from the subzone — the store may have stopped delivering
    // there, or changed the price, since the address was saved.
    const delivery = await this.priceListService.resolve(address.subZone);
    if (!delivery) this.rejectDelivery();
    const shippingFee = delivery.price;
    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));

    // Checked again here with the customer, so per-customer limits apply.
    let coupon: Awaited<ReturnType<CouponsService['check']>> | undefined;
    if (dto.couponCode?.trim()) {
      coupon = await this.couponsService.check(dto.couponCode, subtotal, customerId);
      if (!coupon.ok) this.rejectCoupon(coupon.error, coupon.minSubtotal);
    }
    const applied = coupon?.ok ? coupon : undefined;
    const discount = applied?.discount ?? 0;

    const orderNumber = await this.nextOrderNumber();

    const order = await this.orderModel.create({
      orderNumber,
      customer: new Types.ObjectId(customerId),
      items: lines.map<OrderItem>((line) => ({
        product: new Types.ObjectId(line.productId),
        variantId: line.variantId ? new Types.ObjectId(line.variantId) : undefined,
        name: line.name!,
        variantLabel: line.variantLabel,
        sku: line.sku,
        image: line.image,
        slug: line.slug,
        unitPrice: line.unitPrice!,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        stockDeducted: line.tracksStock,
      })),
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        zone: delivery.zone,
        subZone: delivery.subZone,
        zoneName: delivery.zoneName,
        subZoneName: delivery.subZoneName,
        area: address.area,
        street: address.street,
        building: address.building,
        notes: address.notes,
      },
      subtotal,
      discount,
      coupon: applied
        ? { code: applied.coupon.code, type: applied.coupon.type, value: applied.coupon.value }
        : undefined,
      shippingFee,
      total: round2(subtotal - discount + shippingFee),
      currency,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY,
      status: OrderStatus.PENDING,
      statusHistory: [{ status: OrderStatus.PENDING, at: new Date() }],
      notes: dto.notes,
      locale: dto.locale,
      guestToken: guest?.guestToken,
      canClaimAccount: guest?.canClaimAccount ?? false,
    });

    // Claim the coupon use atomically — the check above can lose a race for
    // the last redemption, and this is where that's decided.
    if (applied && !(await this.couponsService.redeem(applied.coupon._id as Types.ObjectId))) {
      await this.orderModel.deleteOne({ _id: order._id }).exec();
      this.rejectCoupon('usage_limit');
    }

    // Stock moves after the order exists so each sale can point at its order
    // number. The availability check above can be beaten by a concurrent
    // checkout; `adjustMany` is the real guard — it either takes every line or
    // none — and if it refuses, this order is withdrawn as if never placed.
    const sales: AdjustStockDto[] = lines
      .filter((line) => line.tracksStock)
      .map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        type: MovementType.SALE,
        quantity: line.quantity,
        reference: this.reference(orderNumber),
      }));

    try {
      await this.inventoryService.adjustMany(sales);
    } catch (error) {
      await this.orderModel.deleteOne({ _id: order._id }).exec();
      if (applied) await this.couponsService.release(applied.coupon.code);
      // The inventory message quotes the stock it read before losing the race
      // ("2 available, 2 requested"), which reads as nonsense to a shopper.
      if (error instanceof BadRequestException) {
        throw new ConflictException(
          'Someone just bought the last of an item in your cart. Please review your cart and try again.',
        );
      }
      throw error;
    }

    // A guest's confirmation carries the invite to finish their account. Mail
    // is best effort, so a failure making the link mustn't fail the order.
    const activationLink = customer.isGuest
      ? await this.customerAuthService
          .createActivationLink(customer._id as Types.ObjectId, host, dto.locale)
          .catch(() => undefined)
      : undefined;

    // Best effort: a stale saved cart only risks one needless reminder.
    this.customersService
      .clearSavedCart(customer._id as Types.ObjectId)
      .catch((error: Error) => this.logger.warn(`Saved cart not cleared: ${error.message}`));

    this.notifications.orderPlaced(order, {
      host,
      customerEmail: customer.email,
      storeName: settings.storeName,
      currency,
      activationLink,
    });

    return order;
  }

  private rejectCoupon(code: CouponError, minSubtotal?: number): never {
    throw new BadRequestException({
      message: COUPON_MESSAGES[code],
      couponError: { code, minSubtotal },
    });
  }

  private rejectDelivery(): never {
    throw new BadRequestException({
      message: "We don't deliver to this address. Please choose another area.",
      code: 'delivery_unavailable',
    });
  }

  // ── Status changes ──────────────────────────────────────────────────────────

  /** Admin moves an order along. Only transitions in ORDER_TRANSITIONS are allowed. */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note: string | undefined,
    userId: string | undefined,
    host: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    const updated = await this.transition(order, status, { note, by: userId });

    const customer = order.customer as unknown as { email?: string } | undefined;
    await this.notifyStatus(updated, host, customer?.email, { note });
    return updated;
  }

  /**
   * A customer may call off their own order only while the store hasn't
   * accepted it yet. After that it's a conversation with the store.
   */
  async cancelByCustomer(
    customerId: string,
    orderId: string,
    reason: string | undefined,
    host: string,
  ): Promise<Order> {
    const order = await this.findMine(customerId, orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('This order is already cancelled.');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'This order is already being prepared and can no longer be cancelled here. Please contact the store.',
      );
    }
    const updated = await this.transition(order, OrderStatus.CANCELLED, { note: reason });

    const customer = await this.customersService.getProfile(customerId);
    await this.notifyStatus(updated, host, customer.email, { note: reason, byCustomer: true });
    return updated;
  }

  private async notifyStatus(
    order: Order,
    host: string,
    customerEmail: string | undefined,
    change: { note?: string; byCustomer?: boolean },
  ): Promise<void> {
    const settings = await this.getCheckoutSettings();
    this.notifications.statusChanged(
      order,
      {
        host,
        customerEmail,
        storeName: settings.storeName,
        currency: order.currency,
      },
      change,
    );
  }

  private async transition(
    order: Order,
    to: OrderStatus,
    change: { note?: string; by?: string },
  ): Promise<Order> {
    const from = order.status;
    if (from === to) {
      throw new BadRequestException(`The order is already ${to}.`);
    }
    if (!ORDER_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`An order cannot go from ${from} to ${to}.`);
    }

    // Conditional on the status we read: two admins pressing "cancel" at once
    // must not both succeed, or the stock would be returned twice.
    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, status: from },
        {
          $set: { status: to },
          $push: {
            statusHistory: {
              status: to,
              note: change.note,
              by: change.by ? new Types.ObjectId(change.by) : undefined,
              at: new Date(),
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'This order was just changed by someone else. Reload it and try again.',
      );
    }

    if (to === OrderStatus.CANCELLED) {
      await this.restock(updated, change.by);
      // A cancelled order no longer counts against the coupon's limits.
      if (updated.coupon) await this.couponsService.release(updated.coupon.code);
    }

    return updated;
  }

  /**
   * Puts a cancelled order's stock back. Best effort per line: a product that
   * was deleted or stopped tracking stock since the sale has nowhere to return
   * to, and that must not block the cancellation itself.
   */
  private async restock(order: Order, userId?: string): Promise<void> {
    for (const item of order.items.filter((i) => i.stockDeducted)) {
      try {
        await this.inventoryService.adjust(
          {
            productId: item.product.toString(),
            variantId: item.variantId?.toString(),
            type: MovementType.ORDER_CANCELLED,
            quantity: item.quantity,
            reference: this.reference(order.orderNumber),
          },
          userId,
        );
      } catch (error) {
        this.logger.warn(
          `Could not return stock for ${this.reference(order.orderNumber)}, product ${item.product}: ${(error as Error).message}`,
        );
      }
    }
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryOrdersDto): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.paginate(this.buildFilter(query), query, true);
  }

  async findOne(id: string): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Order not found');

    const order = await this.orderModel
      .findById(id)
      .populate('customer', 'name email phone')
      .populate('statusHistory.by', 'name email')
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** The customer's own orders. Never matches another customer's. */
  async findAllMine(
    customerId: string,
    query: QueryOrdersDto,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    const filter: QueryFilter<Order> = { customer: new Types.ObjectId(customerId) };
    if (query.status) filter.status = query.status;
    return this.paginate(filter, query, false);
  }

  /** One of the customer's own orders — someone else's id is a 404, not a 403. */
  async findMine(customerId: string, orderId: string): Promise<Order> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');

    const order = await this.orderModel
      .findOne({ _id: orderId, customer: new Types.ObjectId(customerId) })
      .select('-statusHistory.by')
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Every order matching the list filters as CSV, one row per order — for
   * accounting and delivery spreadsheets. Capped so a careless "all time"
   * export can't take the server down.
   */
  async exportCsv(query: ExportOrdersDto): Promise<string> {
    const lang = query.lang ?? 'en';
    const name = (field?: LocalizedField) => field?.[lang] || field?.en || field?.ar || '';
    const orders = await this.orderModel
      .find(this.buildFilter(query))
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT)
      .populate<{ customer: Customer }>('customer', 'name email')
      .lean()
      .exec();

    const header = [
      'order_number', 'date', 'status', 'customer_name', 'customer_email', 'phone',
      'zone', 'sub_zone', 'address', 'items', 'item_count', 'subtotal', 'discount',
      'coupon', 'shipping_fee', 'total', 'refunded', 'payment_method', 'notes',
    ];
    const rows = orders.map((o) => {
      const a = o.shippingAddress;
      return [
        o.orderNumber,
        (o as unknown as { createdAt: Date }).createdAt,
        o.status,
        a.fullName,
        o.customer?.email ?? '',
        a.phone,
        name(a.zoneName) || a.city || '',
        name(a.subZoneName) || a.area || '',
        [a.street, a.building, a.notes].filter(Boolean).join(', '),
        o.items
          .map((i) => `${i.quantity} × ${name(i.name)}${i.variantLabel ? ` (${i.variantLabel})` : ''}`)
          .join('; '),
        o.items.reduce((sum, i) => sum + i.quantity, 0),
        o.subtotal,
        o.discount ?? 0,
        o.coupon?.code ?? '',
        o.shippingFee,
        o.total,
        o.refundedTotal ?? 0,
        o.paymentMethod,
        o.notes ?? '',
      ];
    });
    return toCsv(header, rows);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Prices each requested line from the catalogue and notes anything that
   * stops it being bought. Repeated product/variant pairs are merged first, so
   * the stock check sees the true total asked for.
   */
  private async resolveLines(items: OrderItemInputDto[]): Promise<ResolvedLine[]> {
    const merged = new Map<string, OrderItemInputDto>();
    for (const item of items) {
      const key = `${item.productId}:${item.variantId ?? ''}`;
      const existing = merged.get(key);
      if (existing) existing.quantity += item.quantity;
      else merged.set(key, { ...item });
    }

    const ids = [...new Set([...merged.values()].map((i) => i.productId))];
    const products = await this.productModel.find({ _id: { $in: ids } }).exec();
    const byId = new Map(products.map((p) => [p._id!.toString(), p]));

    return [...merged.values()].map((item) => {
      const base: ResolvedLine = {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        lineTotal: 0,
        available: null,
        tracksStock: false,
      };

      const product = byId.get(item.productId);
      if (!product || !product.isActive) return { ...base, issue: 'unavailable' };

      const hasVariants = (product.variants?.length ?? 0) > 0;
      const variant = item.variantId
        ? product.variants?.find((v) => v._id.toString() === item.variantId)
        : undefined;

      // A variant product must name an existing variant; a plain one must not.
      if (hasVariants ? !variant : !!item.variantId) {
        return { ...base, name: product.name, slug: product.slug, issue: 'unavailable' };
      }

      const unitPrice = variant?.price ?? product.price;
      const limited = product.trackStock && !product.allowBackorder;
      const available = limited ? (variant ? variant.stock : product.stock) ?? 0 : null;

      const line: ResolvedLine = {
        ...base,
        name: product.name,
        variantLabel: variant?.label,
        sku: variant?.sku ?? product.sku,
        image: product.images?.[0],
        slug: product.slug,
        unitPrice,
        lineTotal: unitPrice != null ? unitPrice * item.quantity : 0,
        available,
        tracksStock: product.trackStock,
      };

      if (unitPrice == null) return { ...line, issue: 'no_price' };
      if (available !== null && available < item.quantity) {
        return { ...line, issue: 'insufficient_stock' };
      }
      return line;
    });
  }

  private async getCheckoutSettings(): Promise<{
    currency?: LocalizedField;
    storeName?: LocalizedField;
  }> {
    const settings = await this.settingModel
      .findOne()
      .select('currency siteTitle')
      .exec();
    return {
      currency: settings?.currency,
      storeName: settings?.siteTitle,
    };
  }

  private async nextOrderNumber(): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { name: ORDER_COUNTER },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
    return ORDER_NUMBER_BASE + counter!.seq;
  }

  private reference(orderNumber: number): string {
    return `Order #${orderNumber}`;
  }

  private buildFilter(query: Pick<QueryOrdersDto, 'status' | 'search' | 'from' | 'to'>): QueryFilter<Order> {
    const filter: QueryFilter<Order> = {};
    if (query.status) filter.status = query.status;

    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const search = query.search?.trim().replace(/^#/, '');
    if (search) {
      const term = new RegExp(this.escapeRegex(search), 'i');
      filter.$or = [
        { 'shippingAddress.fullName': term },
        { 'shippingAddress.phone': term },
      ];
      if (/^\d+$/.test(search)) filter.$or.push({ orderNumber: Number(search) });
    }

    return filter;
  }

  private async paginate(
    filter: QueryFilter<Order>,
    query: QueryOrdersDto,
    withCustomer: boolean,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    let find = this.orderModel
      .find(filter)
      .select('-statusHistory')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (withCustomer) find = find.populate('customer', 'name email phone');

    const [data, total] = await Promise.all([
      find.exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
