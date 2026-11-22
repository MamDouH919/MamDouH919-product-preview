import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, QueryFilter, Types } from 'mongoose';
import { STORE_MODULES, TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { StoreModule } from '../common/tenant/store-plan';
import { withTransaction } from '../common/tenant/with-transaction';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { priceToMinor, toMajor } from '../finance/order-money';
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
import { Setting } from '../settings/schemas/setting.schema';
import { CreateReturnDto, QueryReturnsDto, SettleReturnDto } from './dto/return.dto';
import { ReturnNotificationsService } from './return-notifications.service';

const RETURN_COUNTER = 'return';
const RETURN_NUMBER_BASE = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
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
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    private readonly notifications: ReturnNotificationsService,
    private readonly inventory: InventoryService,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    @Inject(STORE_MODULES) private readonly modules: readonly StoreModule[],
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
    if (query.reason) filter.reason = query.reason;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) filter.createdAt.$lt = new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86_400_000);
    }
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

  /** One return, with the order's figures beside it. Refunding it is the refunds service's job. */
  async findOne(id: string) {
    const ret = await this.returnModel
      .findById(this.oid(id, 'Return not found'))
      .populate('customer', 'name email phone')
      .populate('history.by', 'name email')
      .exec();
    if (!ret) throw new NotFoundException('Return not found');

    const order = await this.orderModel
      .findById(ret.order)
      .select('orderNumber status subtotal discount shippingFee total refundedTotal currency createdAt bookedAt paymentStatus')
      .lean()
      .exec();
    return { ...ret.toObject(), orderSummary: order };
  }

  /** Every return on one order, for the order page. */
  async findForOrder(orderId: string) {
    return this.returnModel.find({ order: this.oid(orderId, 'Order not found') }).sort({ createdAt: -1 }).lean().exec();
  }

  async approve(id: string, note: string | undefined, userId: string | undefined, host: string) {
    return this.transition(id, ReturnStatus.APPROVED, { note, userId, host });
  }

  /** The items arrived back. From here the store refunds what it actually got. */
  async receive(id: string, note: string | undefined, userId: string | undefined, host: string) {
    return this.transition(id, ReturnStatus.RECEIVED, { note, userId, host });
  }

  async reject(id: string, note: string | undefined, userId: string | undefined, host: string) {
    return this.transition(id, ReturnStatus.REJECTED, { note, userId, host });
  }

  /**
   * Closes a return in a store without books: records the money that went
   * back (taken as given — it left the till outside the system) and, where the
   * store keeps stock, puts the chosen lines back on the shelf. A store with books refunds
   * through the refunds service instead, which posts the entries.
   */
  async settle(id: string, dto: SettleReturnDto, userId: string | undefined, host: string): Promise<ReturnRequest> {
    if (this.modules.includes(StoreModule.FINANCE)) {
      throw new NotFoundException('Not found');
    }
    const ret = await withTransaction(this.connection, async (session) => {
      const at = new Date();
      const from = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.RECEIVED];
      // Claimed first so two clicks can't restock twice.
      const claimed = await this.returnModel
        .findOneAndUpdate(
          { _id: this.oid(id, 'Return not found'), status: { $in: from } },
          {
            $set: { status: ReturnStatus.REFUNDED, refundAmount: dto.refundAmount, settledAt: at },
            $push: { history: { status: ReturnStatus.REFUNDED, note: dto.note, by: this.userOid(userId), at } },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!claimed) {
        const exists = await this.returnModel.findById(id).select('status').session(session).lean().exec();
        if (!exists) throw new NotFoundException('Return not found');
        throw new BadRequestException(`A ${exists.status} return can't be settled`);
      }

      const order = await this.orderModel.findById(claimed.order).session(session).exec();
      if (!order) throw new NotFoundException('Order not found');
      const left = priceToMinor(order.total) - priceToMinor(order.refundedTotal ?? 0);
      if (priceToMinor(dto.refundAmount) > left) {
        throw new BadRequestException(`Only ${toMajor(left)} of this order is left to give back`);
      }

      const restock = new Set(dto.restockLines);
      for (const lineIndex of restock) {
        if (!claimed.items.some((item) => item.lineIndex === lineIndex)) {
          throw new BadRequestException(`This return has no line ${lineIndex + 1}`);
        }
      }
      const flags: Record<string, boolean> = {};
      for (const [k, item] of claimed.items.entries()) {
        const source = order.items[item.lineIndex];
        if (!restock.has(item.lineIndex) || !source?.stockDeducted) continue;
        try {
          await this.inventory.adjust(
            {
              productId: String(item.product),
              variantId: item.variantId ? String(item.variantId) : undefined,
              type: MovementType.RETURN,
              quantity: item.quantity,
              reference: `Return #${claimed.returnNumber} (Order #${order.orderNumber})`,
            },
            userId,
            session,
          );
          flags[`items.${k}.restocked`] = true;
        } catch (error) {
          // A product that stopped tracking stock has nothing to put back into.
          if (!(error instanceof BadRequestException || error instanceof NotFoundException)) throw error;
          this.logger.warn(`Return #${claimed.returnNumber}: line ${item.lineIndex + 1} not restocked — ${error.message}`);
        }
      }
      if (Object.keys(flags).length) await this.returnModel.updateOne({ _id: claimed._id }, { $set: flags }, { session }).exec();
      if (dto.refundAmount > 0) await this.addRefunded(order, dto.refundAmount, session);
      return (await this.returnModel.findById(claimed._id).session(session).exec())!;
    });

    const order = await this.orderModel.findById(ret.order).exec();
    if (order) this.notify(ret, order, host, dto.note);
    return ret;
  }

  /** What the order has given back so far; the order page and the customer's invoice read it. */
  private async addRefunded(order: Order, amount: number, session: ClientSession) {
    const result = await this.orderModel
      .updateOne({ _id: order._id, refundedTotal: order.refundedTotal ?? 0 }, { $set: { refundedTotal: toMajor(priceToMinor(order.refundedTotal ?? 0) + priceToMinor(amount)) } }, { session })
      .exec();
    if (!result.modifiedCount) throw new ConflictException('The order changed meanwhile; reload it');
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
