import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { formatMinor, MoneyError, parseMoney } from '../common/money/money';
import { Counter } from '../orders/schemas/counter.schema';
import { CollectionStatus, Custody, Payment } from '../finance/schemas/payment.schema';
import { Refund, RefundMethod, RefundStatus } from '../refunds/schemas/refund.schema';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { signedLine } from '../inventory/inventory.service';
import { Courier } from './schemas/courier.schema';
import { CourierSettlement } from './schemas/courier-settlement.schema';
import { CreateCourierDto, SettleCourierDto, UpdateCourierDto } from './dto/courier.dto';

const SETTLEMENT_COUNTER = 'courier_settlement';
const SETTLEMENT_NUMBER_BASE = 7000;

/** What a courier holds right now and what it is made of. */
export interface CourierCustody {
  payments: Payment[];
  refunds: Refund[];
  collectedMinor: number;
  refundsPaidMinor: number;
  /** collected − refunds paid: the cash they should still have. */
  heldMinor: number;
}

@Injectable()
export class CouriersService {
  constructor(
    @InjectModel(Courier.name) private courierModel: Model<Courier>,
    @InjectModel(CourierSettlement.name) private settlementModel: Model<CourierSettlement>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Refund.name) private refundModel: Model<Refund>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  create(dto: CreateCourierDto) {
    return this.courierModel.create(dto);
  }

  async update(id: string, dto: UpdateCourierDto) {
    const courier = await this.courierModel.findByIdAndUpdate(this.oid(id, 'Courier'), dto, { returnDocument: 'after', runValidators: true }).exec();
    if (!courier) throw new NotFoundException('Courier not found');
    return courier;
  }

  /** Every courier with the COD cash they hold now. */
  async list() {
    const couriers = await this.courierModel.find().sort({ name: 1 }).lean().exec();
    return Promise.all(
      couriers.map(async (c) => {
        const held = await this.custody(c._id as Types.ObjectId);
        return { ...c, heldMinor: held.heldMinor, collections: held.payments.length };
      }),
    );
  }

  /** One courier: what they hold, item by item, and their settlements. */
  async detail(id: string) {
    const courier = await this.courierModel.findById(this.oid(id, 'Courier')).lean().exec();
    if (!courier) throw new NotFoundException('Courier not found');
    const [held, settlements] = await Promise.all([
      this.custody(courier._id as Types.ObjectId),
      this.settlementModel.find({ courier: courier._id }).sort({ date: -1 }).limit(50).lean().exec(),
    ]);
    return { ...courier, ...held, settlements };
  }

  /** Collections a courier still holds, less refunds they paid out of that cash, not yet settled. */
  async custody(courierId: Types.ObjectId, session?: ClientSession): Promise<CourierCustody> {
    const [payments, refunds] = await Promise.all([
      this.paymentModel
        .find({ courier: courierId, custody: Custody.COURIER, status: CollectionStatus.COLLECTED, settlement: { $exists: false } })
        .sort({ collectedAt: 1 })
        .session(session ?? null)
        .exec(),
      this.refundModel
        .find({ courier: courierId, method: RefundMethod.COURIER_CASH, status: RefundStatus.EXECUTED, settlement: { $exists: false } })
        .sort({ executedAt: 1 })
        .session(session ?? null)
        .exec(),
    ]);
    const collectedMinor = payments.reduce((t, p) => t + p.amountMinor, 0);
    const refundsPaidMinor = refunds.reduce((t, r) => t + r.totalMinor, 0);
    return { payments, refunds, collectedMinor, refundsPaidMinor, heldMinor: collectedMinor - refundsPaidMinor };
  }

  /**
   * The courier hands over the cash they hold, as one transaction: every
   * collection and courier-paid refund they hold is marked settled, their fee
   * is booked as a delivery cost, and anything that doesn't match what they
   * hand over is posted to cash over/short — only with a reason.
   */
  async settle(dto: SettleCourierDto, userId?: string) {
    const feesMinor = dto.fees ? this.amount(dto.fees, 'fees') : 0;
    const receivedMinor = this.amount(dto.received, 'received');
    const date = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 60_000) throw new BadRequestException('The date must be today or earlier');

    return withTransaction(this.connection, async (session) => {
      const courier = await this.courierModel.findById(this.oid(dto.courierId, 'Courier')).session(session).exec();
      if (!courier) throw new NotFoundException('Courier not found');

      const held = await this.custody(courier._id as Types.ObjectId, session);
      if (!held.payments.length && !held.refunds.length) throw new BadRequestException(`${courier.name} holds nothing to settle`);
      const expectedMinor = held.heldMinor - feesMinor;
      if (expectedMinor < 0) {
        throw new BadRequestException(
          `The fee is more than the ${formatMinor(held.heldMinor)} ${courier.name} holds; record the rest as a delivery expense`,
        );
      }
      const differenceMinor = receivedMinor - expectedMinor;
      if (differenceMinor !== 0 && !dto.differenceReason) {
        throw new BadRequestException(
          `${formatMinor(Math.abs(differenceMinor))} ${differenceMinor < 0 ? 'short' : 'over'} — say why before settling`,
        );
      }

      const counter = await this.counterModel
        .findOneAndUpdate({ name: SETTLEMENT_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        .exec();
      const [settlement] = await this.settlementModel.create(
        [
          {
            settlementNumber: SETTLEMENT_NUMBER_BASE + counter!.seq,
            courier: courier._id,
            date,
            payments: held.payments.map((p) => p._id),
            refunds: held.refunds.map((r) => r._id),
            collectedMinor: held.collectedMinor,
            refundsPaidMinor: held.refundsPaidMinor,
            feesMinor,
            expectedMinor,
            receivedMinor,
            differenceMinor,
            differenceReason: differenceMinor !== 0 ? dto.differenceReason : undefined,
            note: dto.note,
            createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
          },
        ],
        { session },
      );

      // Claim exactly what was read: a collection settled meanwhile by another
      // request would make these counts differ, and the transaction retries.
      const marked = await Promise.all([
        this.paymentModel
          .updateMany({ _id: { $in: settlement.payments }, settlement: { $exists: false } }, { $set: { settlement: settlement._id } }, { session })
          .exec(),
        this.refundModel
          .updateMany({ _id: { $in: settlement.refunds }, settlement: { $exists: false } }, { $set: { settlement: settlement._id } }, { session })
          .exec(),
      ]);
      if (marked[0].modifiedCount !== held.payments.length || marked[1].modifiedCount !== held.refunds.length) {
        throw new ConflictException('Some of this cash was settled meanwhile; reload and try again');
      }

      await this.journal.post(
        {
          date,
          source: { type: 'courier_settlement', id: settlement._id as Types.ObjectId, number: settlement.settlementNumber, event: 'settled' },
          lines: [
            { account: ACCOUNT.CASH, debitMinor: receivedMinor, moneyAccount: await this.journal.moneyAccount(dto.moneyAccountId, session) },
            { account: ACCOUNT.DELIVERY_COSTS, debitMinor: feesMinor },
            // Short: a loss (debit). Over: a gain (credit).
            signedLine(ACCOUNT.CASH_OVER_SHORT, -differenceMinor),
            { account: ACCOUNT.COURIER_CASH, creditMinor: held.heldMinor },
          ],
          memo: `${courier.name} settled`,
          createdBy: userId,
        },
        session,
      );
      return settlement;
    });
  }

  private amount(value: string, field: string): number {
    try {
      return parseMoney(value);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(`${field}: ${error.message}`);
      throw error;
    }
  }

  private oid(id: string, what: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`${what} not found`);
    return new Types.ObjectId(id);
  }
}
