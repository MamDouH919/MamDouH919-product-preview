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
import { Order, OrderItem } from './schemas/order.schema';
import { Counter } from './schemas/counter.schema';
import { Product } from '../products/schemas/product.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { AdjustStockDto } from '../inventory/dto/adjust-stock.dto';
import { CustomersService } from '../customers/customers.service';
import {
  ORDER_TRANSITIONS,
  OrderStatus,
  PaymentMethod,
} from './enums/order-status.enum';
import {
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
  shippingFee: number;
  total: number;
  currency?: LocalizedField;
  /** True when every line can be ordered exactly as requested. */
  valid: boolean;
}

/** A priced line plus what placing it will do to stock. */
interface ResolvedLine extends QuoteLine {
  tracksStock: boolean;
}

const ORDER_COUNTER = 'order';
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
  ) {}

  // ── Pricing ─────────────────────────────────────────────────────────────────

  /**
   * Prices a basket against the catalogue as it is right now. The cart page
   * calls this to show real prices and flag problems before checkout, and
   * placing an order runs the same check — the client never supplies a price.
   */
  async quote(items: OrderItemInputDto[]): Promise<Quote> {
    const lines = await this.resolveLines(items);
    const { shippingFee, currency } = await this.getCheckoutSettings();

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const valid = lines.every((line) => !line.issue);

    return {
      items: lines.map(({ tracksStock, ...line }) => line),
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      currency,
      valid,
    };
  }

  // ── Placing an order ────────────────────────────────────────────────────────

  async create(customerId: string, dto: CreateOrderDto): Promise<Order> {
    const customer = await this.customersService.getProfile(customerId);
    // The customer guard only checks the token, which stays valid after an
    // admin blocks the account — so check here too.
    if (!customer.isActive) {
      throw new ForbiddenException('This account is blocked from placing orders.');
    }

    const address = await this.customersService.getAddress(customerId, dto.addressId);

    const lines = await this.resolveLines(dto.items);
    const problems = lines.filter((line) => line.issue);
    if (problems.length) {
      throw new BadRequestException({
        message: 'Some items in your cart can no longer be ordered as they are.',
        issues: problems.map(({ tracksStock, ...line }) => line),
      });
    }

    const { shippingFee, currency } = await this.getCheckoutSettings();
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
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
        city: address.city,
        area: address.area,
        street: address.street,
        building: address.building,
        notes: address.notes,
      },
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      currency,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY,
      status: OrderStatus.PENDING,
      statusHistory: [{ status: OrderStatus.PENDING, at: new Date() }],
      notes: dto.notes,
    });

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
      // The inventory message quotes the stock it read before losing the race
      // ("2 available, 2 requested"), which reads as nonsense to a shopper.
      if (error instanceof BadRequestException) {
        throw new ConflictException(
          'Someone just bought the last of an item in your cart. Please review your cart and try again.',
        );
      }
      throw error;
    }

    return order;
  }

  // ── Status changes ──────────────────────────────────────────────────────────

  /** Admin moves an order along. Only transitions in ORDER_TRANSITIONS are allowed. */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note: string | undefined,
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    return this.transition(order, status, { note, by: userId });
  }

  /**
   * A customer may call off their own order only while the store hasn't
   * accepted it yet. After that it's a conversation with the store.
   */
  async cancelByCustomer(
    customerId: string,
    orderId: string,
    reason?: string,
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
    return this.transition(order, OrderStatus.CANCELLED, { note: reason });
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
    shippingFee: number;
    currency?: LocalizedField;
  }> {
    const settings = await this.settingModel.findOne().select('shippingFee currency').exec();
    return {
      shippingFee: settings?.shippingFee ?? 0,
      currency: settings?.currency,
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

  private buildFilter(query: QueryOrdersDto): QueryFilter<Order> {
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
