import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { formatMinor, MoneyError, parseMoney } from '../common/money/money';
import { Order } from '../orders/schemas/order.schema';
import { Counter } from '../orders/schemas/counter.schema';
import { OrderStatus, PaymentMethod } from '../orders/enums/order-status.enum';
import { CollectionStatus, Custody, Payment } from './schemas/payment.schema';
import { JournalEntry } from './schemas/journal-entry.schema';
import { Refund } from '../refunds/schemas/refund.schema';
import { Courier } from '../couriers/schemas/courier.schema';
import { JournalService } from './journal.service';
import { ACCOUNT } from './accounts';
import { moneyOf, orderAmounts, outstandingOf, paymentStatusFor } from './order-money';

const PAYMENT_COUNTER = 'payment';

export interface RecordCollectionInput {
  /** Decimal amount in the store's currency, e.g. "315.00". */
  amount: string | number;
  custody: Custody;
  /** Who holds it, when a courier does — required then, so they can settle it. */
  courierId?: string;
  /** Where the store keeps it, when staff take it; the default cash box when left out. */
  moneyAccountId?: string;
  /** When the customer paid; defaults to now. */
  collectedAt?: string;
  note?: string;
}

/** An order's money as the admin order page shows it. */
export interface OrderFinance {
  booked: boolean;
  bookedAt?: Date;
  paymentStatus: string;
  totalMinor: number;
  collectedMinor: number;
  refundedMinor: number;
  creditedMinor: number;
  writtenOffMinor: number;
  outstandingMinor: number;
  payments: Payment[];
  refunds: Refund[];
  entries: JournalEntry[];
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Refund.name) private refundModel: Model<Refund>,
    @InjectModel(Courier.name) private courierModel: Model<Courier>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  /**
   * Records cash taken from the customer for a delivered order. It moves the
   * receivable into the store's cash, or into what a courier holds until
   * they hand it over. Never more than is still owed: over-collection is
   * refused, not kept as credit.
   */
  async recordCollection(orderId: string, input: RecordCollectionInput, userId?: string): Promise<Payment> {
    const amountMinor = this.amount(input.amount);
    const collectedAt = input.collectedAt ? new Date(input.collectedAt) : new Date();
    if (Number.isNaN(collectedAt.getTime())) throw new BadRequestException('collectedAt is not a date');
    if (collectedAt.getTime() > Date.now() + 60_000) throw new BadRequestException('A collection cannot be in the future');

    return withTransaction(this.connection, async (session) => {
      let courier: Types.ObjectId | undefined;
      if (input.custody === Custody.COURIER) {
        if (!input.courierId || !Types.ObjectId.isValid(input.courierId)) throw new BadRequestException('Say which courier holds the cash');
        const found = await this.courierModel.findById(input.courierId).select('isActive').session(session).lean().exec();
        if (!found?.isActive) throw new BadRequestException('That courier is not found or inactive');
        courier = found._id as Types.ObjectId;
      }

      const order = await this.findOrder(orderId, session);
      if (order.status !== OrderStatus.DELIVERED || !order.bookedAt) {
        throw new BadRequestException(
          order.status === OrderStatus.DELIVERED
            ? 'This order was delivered before the books started, so collections are not tracked for it'
            : 'Cash is collected on delivery; mark the order delivered first',
        );
      }
      if (collectedAt < order.bookedAt) {
        throw new BadRequestException('A collection cannot be dated before the order was delivered');
      }

      const { totalMinor } = orderAmounts(order);
      const collected = order.money?.collectedMinor ?? 0;
      const outstanding = outstandingOf(totalMinor, order.money);
      if (amountMinor > outstanding) {
        throw new BadRequestException(
          `Only ${formatMinor(outstanding)} is still owed on order #${order.orderNumber}`,
        );
      }

      const [payment] = await this.paymentModel.create(
        [
          {
            paymentNumber: await this.nextNumber(session),
            order: order._id,
            orderNumber: order.orderNumber,
            customer: order.customer,
            method: order.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY,
            amountMinor,
            status: CollectionStatus.COLLECTED,
            custody: input.custody,
            courier,
            collectedAt,
            recordedBy: userId ? new Types.ObjectId(userId) : undefined,
            note: input.note,
          },
        ],
        { session },
      );

      await this.journal.post(
        {
          date: collectedAt,
          source: { type: 'payment', id: payment._id as Types.ObjectId, number: payment.paymentNumber, event: 'collected' },
          lines: [
            {
              account: input.custody === Custody.COURIER ? ACCOUNT.COURIER_CASH : ACCOUNT.CASH,
              debitMinor: amountMinor,
              order: order._id as Types.ObjectId,
              ...(input.custody === Custody.STORE ? { moneyAccount: await this.journal.moneyAccount(input.moneyAccountId, session) } : {}),
            },
            {
              account: ACCOUNT.RECEIVABLES,
              creditMinor: amountMinor,
              order: order._id as Types.ObjectId,
              customer: order.customer,
            },
          ],
          memo: `Collection #${payment.paymentNumber} for order #${order.orderNumber}`,
          createdBy: userId,
        },
        session,
      );

      await this.setCollected(order, totalMinor, collected + amountMinor, session);
      return payment;
    });
  }

  /**
   * Undoes a collection recorded by mistake. The payment stays, marked voided,
   * and a reversing entry dated now puts the receivable back — the original
   * entry is never touched, so a closed period keeps the figures it had.
   */
  async voidCollection(paymentId: string, reason: string, userId?: string): Promise<Payment> {
    if (!reason?.trim()) throw new BadRequestException('Say why the collection is being voided');
    if (!Types.ObjectId.isValid(paymentId)) throw new NotFoundException('Payment not found');

    return withTransaction(this.connection, async (session) => {
      const now = new Date();
      const payment = await this.paymentModel
        .findOneAndUpdate(
          { _id: paymentId, status: CollectionStatus.COLLECTED },
          {
            $set: {
              status: CollectionStatus.VOIDED,
              voidedAt: now,
              voidedBy: userId ? new Types.ObjectId(userId) : undefined,
              voidReason: reason.trim(),
            },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!payment) {
        const exists = await this.paymentModel.exists({ _id: paymentId }).session(session);
        if (!exists) throw new NotFoundException('Payment not found');
        throw new ConflictException('This collection is already voided');
      }

      // Cash a courier has already handed over is accounted for in that settlement.
      if (payment.settlement) {
        throw new ConflictException(`Collection #${payment.paymentNumber} was already settled with the courier and can't be voided`);
      }
      const original = await this.journal.findBySource('payment', payment._id as Types.ObjectId, 'collected', session);
      if (!original) throw new ConflictException(`Collection #${payment.paymentNumber} has no journal entry to reverse`);
      await this.journal.reverse(original, 'voided', now, session, userId);

      const order = await this.findOrder(String(payment.order), session);
      const { totalMinor } = orderAmounts(order);
      const collected = (order.money?.collectedMinor ?? 0) - payment.amountMinor;
      // Cash already handed back can't outlive the collection it came from.
      if (collected < (order.money?.cashRefundedMinor ?? 0)) {
        throw new ConflictException(
          `Order #${order.orderNumber} has ${formatMinor(order.money.cashRefundedMinor)} refunded in cash; reverse that refund before voiding this collection`,
        );
      }
      await this.setCollected(order, totalMinor, collected, session);
      return payment;
    });
  }

  /**
   * Gives up on what a customer still owes — they won't pay it. Books it as
   * an uncollectible receivable, dated now; it can't exceed what is owed.
   * Defaults to everything still owed.
   */
  async writeOff(orderId: string, amount: string | undefined, reason: string, userId?: string): Promise<Order> {
    if (!reason?.trim()) throw new BadRequestException('Say why it is being written off');
    return withTransaction(this.connection, async (session) => {
      const order = await this.findOrder(orderId, session);
      if (!order.bookedAt) throw new BadRequestException('Only an order in the books can have its balance written off');
      const { totalMinor } = orderAmounts(order);
      const owed = outstandingOf(totalMinor, order.money);
      const amountMinor = amount === undefined ? owed : this.amount(amount);
      if (amountMinor <= 0 || amountMinor > owed) {
        throw new BadRequestException(owed > 0 ? `Only ${formatMinor(owed)} is still owed` : 'Nothing is owed on this order');
      }

      const writtenOff = (order.money?.writtenOffMinor ?? 0) + amountMinor;
      await this.journal.post(
        {
          date: new Date(),
          // One entry per write-off; the running total keeps each one's key unique.
          source: { type: 'order', id: order._id as Types.ObjectId, number: order.orderNumber, event: `written_off:${writtenOff}` },
          lines: [
            { account: ACCOUNT.UNCOLLECTIBLE, debitMinor: amountMinor, order: order._id as Types.ObjectId },
            { account: ACCOUNT.RECEIVABLES, creditMinor: amountMinor, order: order._id as Types.ObjectId, customer: order.customer },
          ],
          memo: `Order #${order.orderNumber} written off: ${reason.trim()}`,
          createdBy: userId,
        },
        session,
      );
      const money = { ...moneyOf(order), writtenOffMinor: writtenOff };
      // A plain object: a document would carry this transaction's session out with it.
      return (await this.orderModel
        .findOneAndUpdate(
          { _id: order._id },
          { $set: { 'money.writtenOffMinor': writtenOff, paymentStatus: paymentStatusFor(totalMinor, money) } },
          { returnDocument: 'after', session },
        )
        .lean<Order>()
        .exec())!;
    });
  }

  /** Everything about one order's money, for its admin page. */
  async orderFinance(orderId: string): Promise<OrderFinance> {
    const order = await this.findOrder(orderId);
    const { totalMinor } = orderAmounts(order);
    const collectedMinor = order.money?.collectedMinor ?? 0;
    const [payments, refunds, entries] = await Promise.all([
      this.paymentModel.find({ order: order._id }).sort({ collectedAt: 1 }).populate('recordedBy voidedBy', 'name').exec(),
      this.refundModel.find({ order: order._id }).sort({ createdAt: 1 }).exec(),
      this.entryModel.find({ 'lines.order': order._id }).sort({ date: 1, entryNumber: 1 }).exec(),
    ]);
    return {
      booked: !!order.bookedAt,
      bookedAt: order.bookedAt,
      paymentStatus: order.paymentStatus,
      totalMinor,
      collectedMinor,
      refundedMinor: order.money?.refundedMinor ?? 0,
      creditedMinor: order.money?.creditedMinor ?? 0,
      writtenOffMinor: order.money?.writtenOffMinor ?? 0,
      outstandingMinor: order.bookedAt ? outstandingOf(totalMinor, order.money) : 0,
      payments,
      refunds,
      entries,
    };
  }

  private async setCollected(order: Order, totalMinor: number, collectedMinor: number, session: ClientSession) {
    // Concurrent collections on one order both write this document, so the
    // transaction that commits second retries and sees the first one's total.
    const money = { ...moneyOf(order), collectedMinor };
    await this.orderModel
      .updateOne(
        { _id: order._id },
        { $set: { 'money.collectedMinor': collectedMinor, paymentStatus: paymentStatusFor(totalMinor, money) } },
        { session },
      )
      .exec();
  }

  private async findOrder(orderId: string, session?: ClientSession): Promise<Order> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');
    const order = await this.orderModel.findById(orderId).session(session ?? null).exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private amount(value: string | number): number {
    try {
      const minor = parseMoney(value);
      if (minor <= 0) throw new MoneyError('The amount must be above zero');
      return minor;
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async nextNumber(session: ClientSession): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate({ name: PAYMENT_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      .exec();
    return counter!.seq;
  }
}
