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
import {
  RETURN_TRANSITIONS,
  ReturnItem,
  ReturnReason,
  ReturnRequest,
  ReturnStatus,
} from './schemas/return-request.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Counter } from '../orders/schemas/counter.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Product } from '../products/schemas/product.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { CreateReturnDto, QueryReturnsDto, RefundReturnDto } from './dto/return.dto';
import { ReturnNotificationsService } from './return-notifications.service';

const RETURN_COUNTER = 'return';
const RETURN_NUMBER_BASE = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

export interface ReturnableLine {
  lineIndex: number;
  name: Order['items'][number]['name'];
  variantLabel?: string;
  image?: string;
  unitPrice: number;
  purchased: number;
  /** Purchased minus what other open or finished returns already cover. */
  returnable: number;
}

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectModel(ReturnRequest.name) private returnModel: Model<ReturnRequest>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    private readonly inventoryService: InventoryService,
    private readonly notifications: ReturnNotificationsService,
  ) {}

  // ── Customer ────────────────────────────────────────────────────────────────

  /**
   * What the customer's order page needs: whether a return can be asked for
   * now, until when, how much of each line is left to return, and the
   * returns already opened on the order.
   */
  async customerView(customerId: string, orderId: string) {
    const order = await this.findOrder(orderId, customerId);
    const [settings, requests] = await Promise.all([
      this.settingModel.findOne().select('returnWindowDays').lean().exec(),
      this.returnModel.find({ order: order._id }).sort({ createdAt: -1 }).select('-history.by').lean().exec(),
    ]);
    const windowDays = settings?.returnWindowDays ?? 14;
    const deliveredAt = this.deliveredAt(order);
    const deadline = deliveredAt && windowDays > 0 ? new Date(deliveredAt.getTime() + windowDays * DAY_MS) : null;
    const lines = this.returnableLines(order, requests as unknown as ReturnRequest[]);

    return {
      eligible: !!deadline && Date.now() <= deadline.getTime() && lines.some((l) => l.returnable > 0),
      windowDays,
      deadline,
      lines,
      requests,
    };
  }

  async createByCustomer(customerId: string, dto: CreateReturnDto, host: string): Promise<ReturnRequest> {
    const view = await this.customerView(customerId, dto.orderId);
    if (!view.eligible) {
      throw new ForbiddenException(
        view.deadline && Date.now() > view.deadline.getTime()
          ? 'The return window for this order has closed'
          : 'This order cannot be returned',
      );
    }
    const order = await this.findOrder(dto.orderId, customerId);
    return this.open(order, dto, 'customer', host);
  }

  // ── Store ───────────────────────────────────────────────────────────────────

  /** A return taken by phone or at the counter. No window: the store decides. Starts approved. */
  async createByStore(dto: CreateReturnDto, userId: string | undefined, host: string): Promise<ReturnRequest> {
    const order = await this.findOrder(dto.orderId);
    return this.open(order, dto, 'store', host, userId);
  }

  async findAll(query: QueryReturnsDto) {
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 25;
    const filter: QueryFilter<ReturnRequest> = {};
    if (query.status) filter.status = query.status;
    const term = query.search?.trim().replace(/^#/, '');
    if (term && /^\d+$/.test(term)) filter.$or = [{ returnNumber: Number(term) }, { orderNumber: Number(term) }];

    const [data, total, counts] = await Promise.all([
      this.returnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customer', 'name email')
        .exec(),
      this.returnModel.countDocuments(filter).exec(),
      this.returnModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    ]);
    const statusCounts = Object.fromEntries(Object.values(ReturnStatus).map((s) => [s, 0])) as Record<ReturnStatus, number>;
    for (const row of counts) statusCounts[row._id as ReturnStatus] = row.count;
    return { data, total, page, limit, statusCounts };
  }

  /** One return with what refunding it needs: the order's money and a suggested amount. */
  async findOne(id: string) {
    const ret = await this.returnModel
      .findById(this.oid(id, 'Return not found'))
      .populate('customer', 'name email phone')
      .populate('history.by', 'name email')
      .exec();
    if (!ret) throw new NotFoundException('Return not found');

    const order = await this.orderModel
      .findById(ret.order)
      .select('orderNumber status subtotal discount shippingFee total refundedTotal currency createdAt')
      .lean()
      .exec();
    const remaining = order ? round2(order.total - (order.refundedTotal ?? 0)) : 0;
    // Line prices less the order's discount share — shipping isn't refunded by default.
    const linesTotal = ret.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const discountShare = order?.subtotal ? (order.discount ?? 0) / order.subtotal : 0;
    const suggestedRefund = Math.max(0, Math.min(remaining, round2(linesTotal * (1 - discountShare))));

    return { ...ret.toObject(), orderSummary: order, refundableRemaining: remaining, suggestedRefund };
  }

  /** Every return on one order, for the order page. */
  async findForOrder(orderId: string) {
    return this.returnModel.find({ order: this.oid(orderId, 'Order not found') }).sort({ createdAt: -1 }).lean().exec();
  }

  async approve(id: string, note: string | undefined, userId: string | undefined, host: string) {
    return this.transition(id, ReturnStatus.APPROVED, { note, userId, host });
  }

  async reject(id: string, note: string | undefined, userId: string | undefined, host: string) {
    return this.transition(id, ReturnStatus.REJECTED, { note, userId, host });
  }

  /**
   * Gives money back and, for the lines chosen, puts stock back on the shelf.
   * The status is claimed first, atomically, so a double click can't refund
   * twice; the amount is then added to the order with a conditional `$inc`
   * that refuses to take refunds past what was paid. Any failure after the
   * claim puts everything back as it was.
   */
  async refund(id: string, dto: RefundReturnDto, userId: string | undefined, host: string) {
    const amount = round2(Number(dto.amount));
    const restock = [...new Set((dto.restock ?? []).map(Number))];

    const before = await this.returnModel.findById(this.oid(id, 'Return not found')).exec();
    if (!before) throw new NotFoundException('Return not found');
    if (!RETURN_TRANSITIONS[before.status].includes(ReturnStatus.REFUNDED)) {
      throw new BadRequestException(`A ${before.status} return can't be refunded`);
    }
    if (restock.some((i) => i >= before.items.length)) throw new BadRequestException('Unknown line to restock');

    const order = await this.orderModel.findById(before.order).exec();
    if (!order) throw new NotFoundException('Order not found');

    // Only lines whose sale actually took stock, of products still tracking it, can go back.
    const products = await this.productModel
      .find({ _id: { $in: restock.map((i) => before.items[i].product) } })
      .select('trackStock')
      .lean()
      .exec();
    const tracking = new Set(products.filter((p) => p.trackStock).map((p) => String(p._id)));
    const restockable = restock.filter((i) => {
      const item = before.items[i];
      return order.items[item.lineIndex]?.stockDeducted && tracking.has(String(item.product));
    });

    const claimed = await this.returnModel
      .findOneAndUpdate(
        { _id: before._id, status: before.status },
        {
          $set: { status: ReturnStatus.REFUNDED, refundAmount: amount },
          $push: { history: { status: ReturnStatus.REFUNDED, note: dto.note, by: this.userOid(userId), at: new Date() } },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!claimed) throw new ConflictException('This return was just changed by someone else — reload it');

    const undoClaim = () =>
      this.returnModel
        .updateOne(
          { _id: before._id },
          { $set: { status: before.status }, $unset: { refundAmount: 1 }, $pop: { history: 1 } },
        )
        .exec();

    if (amount > 0) {
      const paid = await this.orderModel
        .updateOne(
          {
            _id: order._id,
            $expr: { $lte: [{ $add: [{ $ifNull: ['$refundedTotal', 0] }, amount] }, '$total'] },
          },
          { $inc: { refundedTotal: amount } },
        )
        .exec();
      if (!paid.modifiedCount) {
        await undoClaim();
        throw new BadRequestException(
          `Refunds on order #${order.orderNumber} can't exceed what was paid (${round2(order.total - (order.refundedTotal ?? 0))} left)`,
        );
      }
    }

    if (restockable.length) {
      try {
        await this.inventoryService.adjustMany(
          restockable.map((i) => ({
            productId: String(claimed.items[i].product),
            variantId: claimed.items[i].variantId ? String(claimed.items[i].variantId) : undefined,
            type: MovementType.RETURN,
            quantity: claimed.items[i].quantity,
            reference: `Return #${claimed.returnNumber} (Order #${order.orderNumber})`,
          })),
          userId,
        );
      } catch (error) {
        // adjustMany already undid its own movements; undo the money and the claim.
        if (amount > 0) await this.orderModel.updateOne({ _id: order._id }, { $inc: { refundedTotal: -amount } }).exec();
        await undoClaim();
        throw new BadRequestException(`Stock couldn't be returned: ${(error as Error).message}`);
      }
      await this.returnModel
        .updateOne(
          { _id: claimed._id },
          { $set: Object.fromEntries(restockable.map((i) => [`items.${i}.restocked`, true])) },
        )
        .exec();
    }

    const saved = (await this.returnModel.findById(claimed._id).exec())!;
    this.notify(saved, order, host, dto.note);
    return saved;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async open(
    order: Order,
    dto: CreateReturnDto,
    openedBy: 'customer' | 'store',
    host: string,
    userId?: string,
  ): Promise<ReturnRequest> {
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    const existing = await this.returnModel.find({ order: order._id }).lean().exec();
    const lines = this.returnableLines(order, existing as unknown as ReturnRequest[]);

    // Merge repeated lines, then check each against what's left to return.
    const wanted = new Map<number, number>();
    for (const item of dto.items) wanted.set(item.lineIndex, (wanted.get(item.lineIndex) ?? 0) + item.quantity);

    const items: ReturnItem[] = [];
    for (const [lineIndex, quantity] of wanted) {
      const line = lines[lineIndex];
      const source = order.items[lineIndex];
      if (!line || !source) throw new BadRequestException(`Order has no line ${lineIndex + 1}`);
      if (quantity > line.returnable) {
        throw new BadRequestException(
          `Only ${line.returnable} of line ${lineIndex + 1} can still be returned`,
        );
      }
      items.push({
        lineIndex,
        product: source.product,
        variantId: source.variantId,
        name: source.name,
        variantLabel: source.variantLabel,
        image: source.image,
        unitPrice: source.unitPrice,
        quantity,
        restocked: false,
      });
    }

    const status = openedBy === 'store' ? ReturnStatus.APPROVED : ReturnStatus.REQUESTED;
    const now = new Date();
    const ret = await this.returnModel.create({
      returnNumber: await this.nextReturnNumber(),
      order: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      items,
      reason: dto.reason ?? ReturnReason.OTHER,
      note: dto.note || undefined,
      status,
      openedBy,
      history:
        status === ReturnStatus.APPROVED
          ? [
              { status: ReturnStatus.REQUESTED, at: now, by: this.userOid(userId) },
              { status: ReturnStatus.APPROVED, at: now, by: this.userOid(userId) },
            ]
          : [{ status: ReturnStatus.REQUESTED, at: now }],
    });

    this.notify(ret, order, host);
    return ret;
  }

  private async transition(
    id: string,
    to: ReturnStatus,
    { note, userId, host }: { note?: string; userId?: string; host: string },
  ): Promise<ReturnRequest> {
    const from = Object.values(ReturnStatus).filter((s) => RETURN_TRANSITIONS[s].includes(to));
    const ret = await this.returnModel
      .findOneAndUpdate(
        { _id: this.oid(id, 'Return not found'), status: { $in: from } },
        {
          $set: { status: to },
          $push: { history: { status: to, note, by: this.userOid(userId), at: new Date() } },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!ret) {
      const exists = await this.returnModel.findById(id).select('status').lean().exec();
      if (!exists) throw new NotFoundException('Return not found');
      throw new BadRequestException(`A ${exists.status} return can't be ${to}`);
    }
    const order = await this.orderModel.findById(ret.order).exec();
    if (order) this.notify(ret, order, host, note);
    return ret;
  }

  /** Delivered quantity per line, less what non-rejected returns already cover. */
  private returnableLines(order: Order, returns: ReturnRequest[]): ReturnableLine[] {
    const taken = new Map<number, number>();
    for (const r of returns) {
      if (r.status === ReturnStatus.REJECTED) continue;
      for (const item of r.items) taken.set(item.lineIndex, (taken.get(item.lineIndex) ?? 0) + item.quantity);
    }
    return order.items.map((item, lineIndex) => ({
      lineIndex,
      name: item.name,
      variantLabel: item.variantLabel,
      image: item.image,
      unitPrice: item.unitPrice,
      purchased: item.quantity,
      returnable: Math.max(0, item.quantity - (taken.get(lineIndex) ?? 0)),
    }));
  }

  /** When the order last became delivered — the return window counts from there. */
  private deliveredAt(order: Order): Date | null {
    const change = [...(order.statusHistory ?? [])].reverse().find((c) => c.status === OrderStatus.DELIVERED);
    return order.status === OrderStatus.DELIVERED && change ? new Date(change.at) : null;
  }

  /** An order, optionally only if it's this customer's — someone else's is a 404, not a 403. */
  private async findOrder(orderId: string, customerId?: string): Promise<Order> {
    const filter: QueryFilter<Order> = { _id: this.oid(orderId, 'Order not found') };
    if (customerId) filter.customer = new Types.ObjectId(customerId);
    const order = await this.orderModel.findOne(filter).exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private notify(ret: ReturnRequest, order: Order, host: string, note?: string): void {
    // Context lookups are best effort too: a missing email just means no customer mail.
    Promise.all([
      this.customerModel.findById(order.customer).select('email').lean().exec(),
      this.settingModel.findOne().select('siteTitle currency').lean().exec(),
    ])
      .then(([customer, settings]) =>
        this.notifications.statusChanged(
          ret,
          {
            host,
            order,
            customerEmail: customer?.email,
            storeName: settings?.siteTitle,
            currency: order.currency ?? settings?.currency,
          },
          note,
        ),
      )
      .catch((error: Error) => this.logger.warn(`Return #${ret.returnNumber}: no email — ${error.message}`));
  }

  private async nextReturnNumber(): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate({ name: RETURN_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
      .exec();
    return RETURN_NUMBER_BASE + counter!.seq;
  }

  private oid(id: string, notFound: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(notFound);
    return new Types.ObjectId(id);
  }

  private userOid(userId?: string): Types.ObjectId | undefined {
    return userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
  }
}
