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
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { allocate, formatMinor, MoneyError, mulDiv, parseMoney } from '../common/money/money';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Counter } from '../orders/schemas/counter.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { ReturnRequest, ReturnStatus } from '../returns/schemas/return-request.schema';
import { ReturnNotificationsService } from '../returns/return-notifications.service';
import { InventoryService, varianceLines } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { orderAmounts, paymentStatusFor, toMajor } from '../finance/order-money';
import { Refund, RefundMethod, RefundReason, RefundStatus } from './schemas/refund.schema';
import { CreateRefundDto, QueryRefundsDto, RefundBasisDto, UpdateRefundRulesDto } from './dto/refund.dto';
import { User } from '../auth/schemas/user.schema';
import { Courier } from '../couriers/schemas/courier.schema';
import {
  allowedDeliveryMinor,
  autoApproves,
  capacity,
  Capacity,
  CountedRefund,
  isCashMethod,
  isFullReturn,
  needsSecondPerson,
  refundRules,
  RefundRules,
  suggestedLineMinor,
} from './refund-rules';

const REFUND_COUNTER = 'refund';
/** Refund numbers start here — after orders (1001…) and returns (2001…), so the three never read alike. */
const REFUND_NUMBER_BASE = 3000;

/** Refunds that still count against what an order can give back. */
const OPEN = [RefundStatus.REQUESTED, RefundStatus.APPROVED];

/** Where the money comes from for each method. */
const PAID_FROM: Record<RefundMethod, string> = {
  [RefundMethod.CASH]: ACCOUNT.CASH,
  [RefundMethod.COURIER_CASH]: ACCOUNT.COURIER_CASH,
  [RefundMethod.CREDIT_AGAINST_RECEIVABLE]: ACCOUNT.RECEIVABLES,
};

export interface RefundPreview {
  rules: RefundRules;
  lines: {
    lineIndex: number;
    quantity: number;
    purchased: number;
    remainingQty: number;
    remainingMinor: number;
    suggestedMinor: number;
    /** Whether the sale took stock for this line, so it can go back. */
    restockable: boolean;
  }[];
  productSuggestedMinor: number;
  /** The most the product part can be: what is left of these lines. */
  productMaxMinor: number;
  /** What the delivery-fee policy gives back with this refund. */
  deliverySuggestedMinor: number;
  deliveryMaxMinor: number;
  fullReturn: boolean;
  totalRemainingMinor: number;
  cashRemainingMinor: number;
  creditRemainingMinor: number;
}

/** A refund worked out and checked, ready to write. */
interface Planned {
  order: Order;
  ret?: ReturnRequest;
  rules: RefundRules;
  lines: Refund['lines'];
  productMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  beyondPolicy: boolean;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectModel(Refund.name) private refundModel: Model<Refund>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(ReturnRequest.name) private returnModel: Model<ReturnRequest>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Courier.name) private courierModel: Model<Courier>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
    private readonly inventory: InventoryService,
    private readonly notifications: ReturnNotificationsService,
  ) {}

  // ── Asking ──────────────────────────────────────────────────────────────────

  /** What a refund for these lines would be by the rules, before anyone asks for it. */
  async preview(basis: RefundBasisDto): Promise<RefundPreview> {
    const { order, requested, cap, rules } = await this.basis(basis);
    const lines = requested.map((r) => {
      const line = cap.lines[r.lineIndex];
      return {
        lineIndex: r.lineIndex,
        quantity: r.quantity,
        purchased: line.purchased,
        remainingQty: line.remainingQty,
        remainingMinor: line.remainingMinor,
        suggestedMinor: suggestedLineMinor(line, r.quantity),
        restockable: !!order.items[r.lineIndex]?.stockDeducted,
      };
    });
    const fullReturn = isFullReturn(cap, requested);
    return {
      rules,
      lines,
      productSuggestedMinor: lines.reduce((t, l) => t + l.suggestedMinor, 0),
      productMaxMinor: lines.reduce((t, l) => t + l.remainingMinor, 0),
      deliverySuggestedMinor: allowedDeliveryMinor(rules.deliveryFeeRefund, fullReturn, basis.reason, cap.deliveryRemainingMinor),
      deliveryMaxMinor: cap.deliveryRemainingMinor,
      fullReturn,
      totalRemainingMinor: cap.totalRemainingMinor,
      cashRemainingMinor: cap.cashRemainingMinor,
      creditRemainingMinor: cap.creditRemainingMinor,
    };
  }

  /**
   * Asks for a refund. Checked against every cap, counting the refunds still
   * open as well as those paid — so requests can't add up past what the order
   * can give back. Approved on the spot when it is under the store's
   * threshold and within the delivery-fee policy.
   */
  async request(dto: CreateRefundDto, userId?: string): Promise<Refund> {
    return withTransaction(this.connection, async (session) => {
      // Cash a courier pays out comes off what they hold, so say which courier.
      let courier: Types.ObjectId | undefined;
      if (dto.method === RefundMethod.COURIER_CASH) {
        if (!dto.courierId) throw new BadRequestException('Say which courier pays this refund');
        const found = await this.courierModel.findById(dto.courierId).select('isActive').session(session).lean().exec();
        if (!found?.isActive) throw new BadRequestException('That courier is not found or inactive');
        courier = found._id as Types.ObjectId;
      }
      const planned = await this.plan(dto, session);
      const moneyAccount = dto.method === RefundMethod.CASH ? await this.journal.moneyAccount(dto.moneyAccountId, session) : undefined;
      const auto = autoApproves(planned.rules, planned.totalMinor, planned.beyondPolicy);
      const at = new Date();
      const by = this.userOid(userId);

      const [refund] = await this.refundModel.create(
        [
          {
            refundNumber: await this.nextNumber(session),
            order: planned.order._id,
            orderNumber: planned.order.orderNumber,
            customer: planned.order.customer,
            returnRequest: planned.ret?._id,
            returnNumber: planned.ret?.returnNumber,
            lines: planned.lines,
            productMinor: planned.productMinor,
            deliveryMinor: planned.deliveryMinor,
            totalMinor: planned.totalMinor,
            method: dto.method,
            courier,
            moneyAccount,
            reason: dto.reason,
            note: dto.note || undefined,
            status: auto ? RefundStatus.APPROVED : RefundStatus.REQUESTED,
            autoApproved: auto,
            beyondPolicy: planned.beyondPolicy,
            requestedBy: by,
            approvedBy: auto ? by : undefined,
            history: [
              { status: RefundStatus.REQUESTED, by, at, note: dto.note || undefined },
              ...(auto ? [{ status: RefundStatus.APPROVED, by, at, note: 'Within the automatic approval limit' }] : []),
            ],
          },
        ],
        { session },
      );
      return refund;
    });
  }

  // ── Deciding ────────────────────────────────────────────────────────────────

  async approve(id: string, userId: string | undefined, note?: string): Promise<Refund> {
    const refund = await this.findRefund(id);
    if (refund.status !== RefundStatus.REQUESTED) {
      throw new ConflictException(`A ${refund.status} refund can't be approved`);
    }
    const rules = await this.rules();
    if (needsSecondPerson(rules, refund.totalMinor) && userId && refund.requestedBy?.equals(userId)) {
      throw new ForbiddenException(
        `Refunds above ${formatMinor(rules.singleApproverUpToMinor)} need an approver other than the person who asked for it`,
      );
    }
    return this.move(refund, [RefundStatus.REQUESTED], RefundStatus.APPROVED, userId, note, { approvedBy: this.userOid(userId) });
  }

  async reject(id: string, userId: string | undefined, note?: string): Promise<Refund> {
    const refund = await this.findRefund(id);
    return this.move(refund, OPEN, RefundStatus.REJECTED, userId, note);
  }

  // ── Paying out ──────────────────────────────────────────────────────────────

  /**
   * Gives the money back, as one transaction: the caps are checked again
   * against the refunds already paid, the books get the refund dated now
   * (returns and delivery-fee refunds out of the cash, a courier's cash, or
   * what the customer owes), the order's figures move, approved lines go back
   * on the shelf, and a return it settles is marked refunded. Two payouts
   * racing for the same order write the same order document, so only one of
   * them commits against the caps the other left.
   */
  async execute(id: string, userId: string | undefined, host: string): Promise<Refund> {
    const refund = await withTransaction(this.connection, async (session) => {
      const at = new Date();
      const claimed = await this.refundModel
        .findOneAndUpdate(
          { _id: this.oid(id, 'Refund not found'), status: RefundStatus.APPROVED },
          {
            $set: { status: RefundStatus.EXECUTED, executedAt: at, executedBy: this.userOid(userId) },
            $push: { history: { status: RefundStatus.EXECUTED, by: this.userOid(userId), at } },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!claimed) {
        const existing = await this.refundModel.findById(id).select('status').session(session).lean().exec();
        if (!existing) throw new NotFoundException('Refund not found');
        throw new ConflictException(
          existing.status === RefundStatus.REQUESTED
            ? 'This refund must be approved before it is paid out'
            : `A ${existing.status} refund can't be paid out`,
        );
      }

      const order = await this.orderModel.findById(claimed.order).session(session).exec();
      if (!order) throw new NotFoundException('Order not found');
      const amounts = orderAmounts(order);
      const paid = await this.refundModel
        .find({ order: order._id, status: RefundStatus.EXECUTED, _id: { $ne: claimed._id } })
        .session(session)
        .lean()
        .exec();
      this.assertWithin(capacity(amounts, order.money ?? {}, paid as unknown as CountedRefund[]), claimed);

      // Back on the shelf first: only lines the sale took stock for, of
      // products still tracking it, each at its share of what the line cost.
      const ref = { order: order._id as Types.ObjectId };
      const restocked: Record<string, boolean> = {};
      const costLines: Parameters<JournalService['post']>[0]['lines'] = [];
      const costReturned: Record<string, number> = {};
      for (const [i, line] of claimed.lines.entries()) {
        const item = order.items[line.lineIndex];
        if (!line.restock || line.quantity === 0 || !item?.stockDeducted) continue;
        const share =
          item.costMinor === undefined
            ? undefined
            : Math.min(mulDiv(item.costMinor, line.quantity, item.quantity), item.costMinor - (item.costReturnedMinor ?? 0));
        try {
          const movement = await this.inventory.adjust(
            {
              productId: String(line.product),
              variantId: line.variantId ? String(line.variantId) : undefined,
              type: MovementType.RETURN,
              quantity: line.quantity,
              reference: `Refund #${claimed.refundNumber} (Order #${order.orderNumber})`,
            },
            userId,
            session,
            share,
          );
          restocked[`lines.${i}.restocked`] = true;
          const value = movement.valueMinor ?? 0;
          if (share !== undefined) {
            // The units' cost comes out of cost of goods sold and back into stock.
            costLines.push(
              { account: ACCOUNT.INVENTORY, debitMinor: value, ...ref },
              { account: ACCOUNT.COGS, creditMinor: share, ...ref },
              ...varianceLines(movement.varianceMinor ?? 0).map((l) => ({ ...l, ...ref })),
            );
            costReturned[`items.${line.lineIndex}.costReturnedMinor`] = (item.costReturnedMinor ?? 0) + share;
          } else if (value > 0) {
            // Sold uncosted, back now that the stock has a cost: an inventory gain.
            costLines.push(
              { account: ACCOUNT.INVENTORY, debitMinor: value, ...ref },
              { account: ACCOUNT.INVENTORY_LOSSES, creditMinor: value, ...ref },
            );
          }
        } catch (error) {
          if (!(error instanceof BadRequestException || error instanceof NotFoundException)) throw error;
          this.logger.warn(`Refund #${claimed.refundNumber}: line ${line.lineIndex + 1} not restocked — ${(error as Error).message}`);
        }
      }

      await this.journal.post(
        {
          date: at,
          source: { type: 'refund', id: claimed._id as Types.ObjectId, number: claimed.refundNumber, event: 'executed' },
          lines: [
            { account: ACCOUNT.SALES_RETURNS, debitMinor: claimed.productMinor, ...ref },
            { account: ACCOUNT.DELIVERY_REFUNDS, debitMinor: claimed.deliveryMinor, ...ref },
            {
              account: PAID_FROM[claimed.method],
              creditMinor: claimed.totalMinor,
              ...ref,
              ...(claimed.moneyAccount ? { moneyAccount: claimed.moneyAccount } : {}),
              ...(claimed.method === RefundMethod.CREDIT_AGAINST_RECEIVABLE ? { customer: order.customer } : {}),
            },
            ...costLines,
          ],
          memo: `Refund #${claimed.refundNumber} for order #${order.orderNumber}`,
          createdBy: userId,
        },
        session,
      );

      await this.applyToOrder(order, amounts.totalMinor, claimed, 1, session, costReturned);
      if (Object.keys(restocked).length) {
        await this.refundModel.updateOne({ _id: claimed._id }, { $set: restocked }, { session }).exec();
      }

      if (claimed.returnRequest) await this.settleReturn(claimed, restocked, userId, at, session);
      return (await this.refundModel.findById(claimed._id).session(session).exec())!;
    });

    this.notifyReturn(refund, host);
    return refund;
  }

  /**
   * Undoes a refund paid out by mistake: a reversing entry dated now, the
   * order's figures moved back, and its return reopened as approved. The
   * original entry is untouched, so a closed period keeps its figures.
   * Goods already put back on the shelf stay there — correct them with a
   * stock take if they shouldn't have.
   */
  async reverse(id: string, reason: string, userId: string | undefined): Promise<Refund> {
    return withTransaction(this.connection, async (session) => {
      const at = new Date();
      const settled = await this.refundModel.exists({ _id: this.oid(id, 'Refund not found'), settlement: { $exists: true } }).session(session);
      if (settled) throw new ConflictException('This refund was already settled with the courier and can\'t be reversed');
      const refund = await this.refundModel
        .findOneAndUpdate(
          { _id: this.oid(id, 'Refund not found'), status: RefundStatus.EXECUTED },
          { $set: { status: RefundStatus.REVERSED }, $push: { history: { status: RefundStatus.REVERSED, by: this.userOid(userId), at, note: reason } } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!refund) {
        const existing = await this.refundModel.findById(id).select('status').session(session).lean().exec();
        if (!existing) throw new NotFoundException('Refund not found');
        throw new ConflictException(`A ${existing.status} refund can't be reversed`);
      }

      const original = await this.journal.findBySource('refund', refund._id as Types.ObjectId, 'executed', session);
      if (!original) throw new ConflictException(`Refund #${refund.refundNumber} has no journal entry to reverse`);
      await this.journal.reverse(original, 'reversed', at, session, userId);

      const order = await this.orderModel.findById(refund.order).session(session).exec();
      if (!order) throw new NotFoundException('Order not found');
      await this.applyToOrder(order, orderAmounts(order).totalMinor, refund, -1, session);

      if (refund.returnRequest) {
        await this.returnModel
          .updateOne(
            { _id: refund.returnRequest, status: ReturnStatus.REFUNDED },
            {
              $set: { status: ReturnStatus.APPROVED },
              $unset: { refundAmount: 1 },
              $push: { history: { status: ReturnStatus.APPROVED, by: this.userOid(userId), at, note: `Refund #${refund.refundNumber} reversed: ${reason}` } },
            },
            { session },
          )
          .exec();
      }
      return refund;
    });
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryRefundsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const filter: QueryFilter<Refund> = {};
    if (query.status) filter.status = query.status;
    if (query.orderId) filter.order = new Types.ObjectId(query.orderId);
    if (query.returnId) filter.returnRequest = new Types.ObjectId(query.returnId);

    const [data, total, counts] = await Promise.all([
      this.refundModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customer', 'name email')
        .populate('requestedBy approvedBy executedBy', 'name')
        .exec(),
      this.refundModel.countDocuments(filter).exec(),
      this.refundModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    ]);
    const statusCounts = Object.fromEntries(Object.values(RefundStatus).map((s) => [s, 0])) as Record<RefundStatus, number>;
    for (const row of counts) statusCounts[row._id as RefundStatus] = row.count;
    return { data, total, page, limit, statusCounts };
  }

  async findOne(id: string) {
    const refund = await this.refundModel
      .findById(this.oid(id, 'Refund not found'))
      .populate('customer', 'name email phone')
      .populate('requestedBy approvedBy executedBy history.by', 'name')
      .exec();
    if (!refund) throw new NotFoundException('Refund not found');
    return { ...refund.toObject(), rules: await this.rules() };
  }

  // ── Rules ───────────────────────────────────────────────────────────────────

  /** The store's refund rules and their change history. */
  async getRules() {
    const settings = await this.settingModel.findOne().select('finance').lean().exec();
    return { ...refundRules(settings?.finance), history: (settings?.finance?.history ?? []).slice(-50) };
  }

  /**
   * Changes the store's refund rules — its own Super Admin only. Each changed
   * field is recorded with what it was and what it became.
   */
  async updateRules(dto: UpdateRefundRulesDto, userId: string | undefined) {
    const user = userId ? await this.userModel.findById(userId).select('isSuper').lean().exec() : null;
    if (!user?.isSuper) throw new ForbiddenException("Only this store's super admin can change its refund rules");

    const current = await this.rules();
    const next: RefundRules = {
      autoApproveUpToMinor: dto.autoApproveUpTo !== undefined ? this.amount(dto.autoApproveUpTo, 'autoApproveUpTo') : current.autoApproveUpToMinor,
      singleApproverUpToMinor:
        dto.singleApproverUpTo !== undefined ? this.amount(dto.singleApproverUpTo, 'singleApproverUpTo') : current.singleApproverUpToMinor,
      deliveryFeeRefund: dto.deliveryFeeRefund ?? current.deliveryFeeRefund,
    };
    if (next.autoApproveUpToMinor > next.singleApproverUpToMinor) {
      throw new BadRequestException('The automatic approval limit cannot be above the single-approver limit');
    }

    const fields: [keyof RefundRules, string][] = [
      ['autoApproveUpToMinor', 'finance.refundAutoApproveUpToMinor'],
      ['singleApproverUpToMinor', 'finance.refundSingleApproverUpToMinor'],
      ['deliveryFeeRefund', 'finance.deliveryFeeRefund'],
    ];
    const at = new Date();
    const changes = fields
      .filter(([key]) => next[key] !== current[key])
      .map(([key]) => ({ field: key, from: current[key], to: next[key], by: this.userOid(userId), at }));
    if (changes.length) {
      await this.settingModel
        .updateOne(
          {},
          {
            $set: Object.fromEntries(fields.map(([key, path]) => [path, next[key]])),
            $push: { 'finance.history': { $each: changes } },
          },
          { upsert: true },
        )
        .exec();
    }
    return this.getRules();
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** The order, the lines asked about, and what remains refundable counting open refunds too. */
  private async basis(basis: RefundBasisDto, session?: ClientSession) {
    const order = await this.orderModel.findById(this.oid(basis.orderId, 'Order not found')).session(session ?? null).exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED || !order.bookedAt) {
      throw new BadRequestException(
        order.status === OrderStatus.DELIVERED
          ? 'This order was delivered before the books started, so it is refunded outside them'
          : 'Only a delivered order can be refunded; cancel an undelivered one instead',
      );
    }

    let ret: ReturnRequest | undefined;
    if (basis.returnId) {
      ret = (await this.returnModel.findOne({ _id: this.oid(basis.returnId, 'Return not found'), order: order._id }).session(session ?? null).exec()) ?? undefined;
      if (!ret) throw new NotFoundException('Return not found on this order');
      if (![ReturnStatus.REQUESTED, ReturnStatus.APPROVED].includes(ret.status)) {
        throw new ConflictException(`A ${ret.status} return can't be refunded`);
      }
      const other = await this.refundModel
        .exists({ returnRequest: ret._id, status: { $in: [...OPEN, RefundStatus.EXECUTED] } })
        .session(session ?? null);
      if (other) throw new ConflictException(`Return #${ret.returnNumber} already has a refund`);
    }

    const requested = (basis.lines ?? ret?.items.map((i) => ({ lineIndex: i.lineIndex, quantity: i.quantity, restock: basis.reason !== RefundReason.DAMAGED })) ?? []).map((l) => ({
      lineIndex: l.lineIndex,
      quantity: l.quantity,
      restock: !!l.restock,
    }));
    const seen = new Set<number>();
    for (const line of requested) {
      if (!order.items[line.lineIndex]) throw new BadRequestException(`Order has no line ${line.lineIndex + 1}`);
      if (seen.has(line.lineIndex)) throw new BadRequestException(`Line ${line.lineIndex + 1} is listed twice`);
      seen.add(line.lineIndex);
      if (ret) {
        const returned = ret.items.find((i) => i.lineIndex === line.lineIndex)?.quantity ?? 0;
        if (line.quantity > returned) {
          throw new BadRequestException(`Return #${ret.returnNumber} only brings back ${returned} of line ${line.lineIndex + 1}`);
        }
      }
    }

    const counted = await this.refundModel
      .find({ order: order._id, status: { $in: [...OPEN, RefundStatus.EXECUTED] } })
      .session(session ?? null)
      .lean()
      .exec();
    const cap = capacity(orderAmounts(order), order.money ?? {}, counted as unknown as CountedRefund[]);
    for (const line of requested) {
      const left = cap.lines[line.lineIndex].remainingQty;
      if (line.quantity > left) throw new BadRequestException(`Only ${left} of line ${line.lineIndex + 1} can still be refunded`);
    }
    return { order, ret, requested, cap, rules: await this.rules(session) };
  }

  /** Works out the amounts of a requested refund and checks every cap. */
  private async plan(dto: CreateRefundDto, session: ClientSession): Promise<Planned> {
    const { order, ret, requested, cap, rules } = await this.basis(dto, session);

    const suggested = requested.map((r) => suggestedLineMinor(cap.lines[r.lineIndex], r.quantity));
    const remaining = requested.map((r) => cap.lines[r.lineIndex].remainingMinor);
    const productMax = remaining.reduce((a, b) => a + b, 0);
    const productSuggested = suggested.reduce((a, b) => a + b, 0);
    const productMinor = dto.productAmount !== undefined ? this.amount(dto.productAmount, 'productAmount') : productSuggested;
    if (productMinor > productMax) {
      throw new BadRequestException(`The product part can be at most ${formatMinor(productMax)} for these lines`);
    }
    // Split across the lines by their suggested shares (or what remains of
    // them, past the suggestion); every share then stays within its line.
    const weights = productMinor <= productSuggested && productSuggested > 0 ? suggested : remaining;
    const shares = productMinor > 0 ? allocate(productMinor, weights) : requested.map(() => 0);

    const fullReturn = isFullReturn(cap, requested);
    const allowed = allowedDeliveryMinor(rules.deliveryFeeRefund, fullReturn, dto.reason, cap.deliveryRemainingMinor);
    const deliveryMinor = dto.deliveryAmount !== undefined ? this.amount(dto.deliveryAmount, 'deliveryAmount') : allowed;
    if (deliveryMinor > cap.deliveryRemainingMinor) {
      throw new BadRequestException(`At most ${formatMinor(cap.deliveryRemainingMinor)} of the delivery fee is left to refund`);
    }
    const beyondPolicy = deliveryMinor > allowed;
    if (beyondPolicy && !dto.note) {
      throw new BadRequestException("Giving back more of the delivery fee than the store's policy allows needs a note saying why");
    }

    const totalMinor = productMinor + deliveryMinor;
    if (totalMinor <= 0) throw new BadRequestException('A refund must give something back');

    const lines = requested.map((r, i) => ({
      lineIndex: r.lineIndex,
      product: order.items[r.lineIndex].product,
      variantId: order.items[r.lineIndex].variantId,
      quantity: r.quantity,
      amountMinor: shares[i],
      restock: r.restock && r.quantity > 0,
      restocked: false,
    }));
    this.assertWithin(cap, { lines, deliveryMinor, totalMinor, method: dto.method });
    return { order, ret, rules, lines, productMinor, deliveryMinor, totalMinor, beyondPolicy };
  }

  /** Refuses a refund that would pass any cap. */
  private assertWithin(cap: Capacity, refund: CountedRefund): void {
    for (const line of refund.lines) {
      const left = cap.lines[line.lineIndex];
      if (line.quantity > left.remainingQty || line.amountMinor > left.remainingMinor) {
        throw new ConflictException(
          `Line ${line.lineIndex + 1} has only ${left.remainingQty} unit(s) and ${formatMinor(left.remainingMinor)} left to refund`,
        );
      }
    }
    if (refund.deliveryMinor > cap.deliveryRemainingMinor) {
      throw new ConflictException(`Only ${formatMinor(cap.deliveryRemainingMinor)} of the delivery fee is left to refund`);
    }
    if (refund.totalMinor > cap.totalRemainingMinor) {
      throw new ConflictException(`Only ${formatMinor(cap.totalRemainingMinor)} of this order is left to refund`);
    }
    if (isCashMethod(refund.method) && refund.totalMinor > cap.cashRemainingMinor) {
      throw new ConflictException(
        `Only ${formatMinor(Math.max(0, cap.cashRemainingMinor))} was collected and not yet refunded; refund the rest as a credit against what is owed`,
      );
    }
    if (refund.method === RefundMethod.CREDIT_AGAINST_RECEIVABLE && refund.totalMinor > cap.creditRemainingMinor) {
      throw new ConflictException(`Only ${formatMinor(Math.max(0, cap.creditRemainingMinor))} is still owed to take a credit against`);
    }
  }

  /** Moves the order's refund figures by one refund (`sign` −1 undoes one) and its payment status with them. */
  private async applyToOrder(
    order: Order,
    totalMinor: number,
    refund: Refund,
    sign: 1 | -1,
    session: ClientSession,
    extra: Record<string, number> = {},
  ) {
    const money = order.money ?? ({} as Order['money']);
    const cash = isCashMethod(refund.method) ? refund.totalMinor : 0;
    const credit = refund.method === RefundMethod.CREDIT_AGAINST_RECEIVABLE ? refund.totalMinor : 0;
    const next = {
      collectedMinor: money.collectedMinor ?? 0,
      refundedMinor: (money.refundedMinor ?? 0) + sign * refund.totalMinor,
      cashRefundedMinor: (money.cashRefundedMinor ?? 0) + sign * cash,
      creditedMinor: (money.creditedMinor ?? 0) + sign * credit,
      deliveryRefundedMinor: (money.deliveryRefundedMinor ?? 0) + sign * refund.deliveryMinor,
      writtenOffMinor: money.writtenOffMinor ?? 0,
    };
    const lineFields = Object.fromEntries(
      refund.lines.flatMap((l) => [
        [`items.${l.lineIndex}.refundedQty`, (order.items[l.lineIndex].refundedQty ?? 0) + sign * l.quantity],
        [`items.${l.lineIndex}.refundedMinor`, (order.items[l.lineIndex].refundedMinor ?? 0) + sign * l.amountMinor],
      ]),
    );
    await this.orderModel
      .updateOne(
        { _id: order._id },
        {
          $set: {
            'money.refundedMinor': next.refundedMinor,
            'money.cashRefundedMinor': next.cashRefundedMinor,
            'money.creditedMinor': next.creditedMinor,
            'money.deliveryRefundedMinor': next.deliveryRefundedMinor,
            // The pounds figure screens and the invoice already show.
            refundedTotal: toMajor(next.refundedMinor),
            paymentStatus: paymentStatusFor(totalMinor, next),
            ...lineFields,
            ...extra,
          },
        },
        { session },
      )
      .exec();
  }

  /** Marks the refund's return as refunded, with what went back on the shelf. */
  private async settleReturn(refund: Refund, restocked: Record<string, boolean>, userId: string | undefined, at: Date, session: ClientSession) {
    const ret = await this.returnModel.findById(refund.returnRequest).session(session).exec();
    if (!ret || ![ReturnStatus.REQUESTED, ReturnStatus.APPROVED].includes(ret.status)) {
      throw new ConflictException('The return this refund settles was closed meanwhile; reload it');
    }
    const itemFlags = Object.fromEntries(
      refund.lines.flatMap((line, i) => {
        const k = ret.items.findIndex((item) => item.lineIndex === line.lineIndex);
        return k >= 0 && restocked[`lines.${i}.restocked`] ? [[`items.${k}.restocked`, true]] : [];
      }),
    );
    await this.returnModel
      .updateOne(
        { _id: ret._id },
        {
          $set: { status: ReturnStatus.REFUNDED, refundAmount: toMajor(refund.totalMinor), ...itemFlags },
          $push: { history: { status: ReturnStatus.REFUNDED, by: this.userOid(userId), at, note: `Refund #${refund.refundNumber}` } },
        },
        { session },
      )
      .exec();
  }

  /** Best effort, after commit: the customer hears that their return was refunded. */
  private notifyReturn(refund: Refund, host: string): void {
    if (!refund.returnRequest) return;
    Promise.all([
      this.returnModel.findById(refund.returnRequest).exec(),
      this.orderModel.findById(refund.order).select('orderNumber locale guestToken currency').lean().exec(),
      this.customerModel.findById(refund.customer).select('email').lean().exec(),
      this.settingModel.findOne().select('siteTitle currency').lean().exec(),
    ])
      .then(([ret, order, customer, settings]) => {
        if (!ret || !order) return;
        this.notifications.statusChanged(ret, {
          host,
          order: order as never,
          customerEmail: customer?.email,
          storeName: settings?.siteTitle,
          currency: order.currency ?? settings?.currency,
        });
      })
      .catch((error: Error) => this.logger.warn(`Refund #${refund.refundNumber}: no email — ${error.message}`));
  }

  private async move(
    refund: Refund,
    from: RefundStatus[],
    to: RefundStatus,
    userId: string | undefined,
    note: string | undefined,
    extra: Record<string, unknown> = {},
  ): Promise<Refund> {
    const updated = await this.refundModel
      .findOneAndUpdate(
        { _id: refund._id, status: { $in: from } },
        { $set: { status: to, ...extra }, $push: { history: { status: to, by: this.userOid(userId), at: new Date(), note } } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) throw new ConflictException(`A ${refund.status} refund can't become ${to}; reload it`);
    return updated;
  }

  private async rules(session?: ClientSession): Promise<RefundRules> {
    const settings = await this.settingModel.findOne().select('finance').session(session ?? null).lean().exec();
    return refundRules(settings?.finance);
  }

  private async findRefund(id: string): Promise<Refund> {
    const refund = await this.refundModel.findById(this.oid(id, 'Refund not found')).exec();
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  private amount(value: string, field: string): number {
    try {
      return parseMoney(value);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(`${field}: ${error.message}`);
      throw error;
    }
  }

  private async nextNumber(session: ClientSession): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate({ name: REFUND_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      .exec();
    return REFUND_NUMBER_BASE + counter!.seq;
  }

  /** A document id from the URL; anything that isn't one reads as not found. */
  private oid(id: string, notFound: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(notFound);
    return new Types.ObjectId(id);
  }

  /** The acting admin, when there is one. */
  private userOid(userId?: string): Types.ObjectId | undefined {
    return userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
  }
}
