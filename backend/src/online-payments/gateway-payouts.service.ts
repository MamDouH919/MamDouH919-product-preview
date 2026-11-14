import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { formatMinor, MoneyError, parseMoney } from '../common/money/money';
import { Counter } from '../orders/schemas/counter.schema';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { memo } from '../finance/journal-memo';
import { GatewayPayout, PayoutStatus } from './schemas/gateway-payout.schema';
import { RecordPayoutDto } from './dto/gateway-payout.dto';

const PAYOUT_COUNTER = 'gateway_payout';
/** The `source.type` of every payout entry in the journal. */
export const PAYOUT_SOURCE = 'gateway_payout';

/**
 * Gateway payouts in the books. The gateway holds what customers paid until it
 * settles to the bank; recording the settlement (and the fees it kept) is what
 * lets "Online payments held by the gateway" fall back to what it really holds.
 */
@Injectable()
export class GatewayPayoutsService {
  constructor(
    @InjectModel(GatewayPayout.name) private payoutModel: Model<GatewayPayout>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  /** The payouts, newest first, with what the gateway is holding right now. */
  async list() {
    const [payouts, balances] = await Promise.all([
      this.payoutModel.find().sort({ date: -1, payoutNumber: -1 }).limit(200).lean().exec(),
      this.journal.balances({}, [ACCOUNT.GATEWAY_BALANCE]),
    ]);
    return { heldMinor: balances[ACCOUNT.GATEWAY_BALANCE] ?? 0, payouts };
  }

  async record(dto: RecordPayoutDto, userId?: string): Promise<GatewayPayout> {
    const grossMinor = this.amount(dto.grossAmount, 'grossAmount');
    const feeMinor = dto.feeAmount ? this.amount(dto.feeAmount, 'feeAmount') : 0;
    if (grossMinor <= 0) throw new BadRequestException('A payout must be more than zero');
    if (feeMinor > grossMinor) throw new BadRequestException('The fees cannot be more than the payout');
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 24 * 3_600_000) {
      throw new BadRequestException('A payout cannot be dated in the future');
    }
    const netMinor = grossMinor - feeMinor;

    return withTransaction(this.connection, async (session) => {
      const held = (await this.journal.balances({}, [ACCOUNT.GATEWAY_BALANCE]))[ACCOUNT.GATEWAY_BALANCE] ?? 0;
      if (grossMinor > held) {
        throw new ConflictException(`The gateway is holding only ${formatMinor(held)} in the books; a payout can't be more than that`);
      }
      const moneyAccount = await this.journal.moneyAccount(dto.moneyAccountId, session);
      const counter = await this.counterModel
        .findOneAndUpdate({ name: PAYOUT_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        .exec();
      const [payout] = await this.payoutModel.create(
        [
          {
            payoutNumber: counter!.seq,
            date,
            grossMinor,
            feeMinor,
            netMinor,
            moneyAccount,
            reference: dto.reference?.trim() || undefined,
            note: dto.note?.trim() || undefined,
            createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
          },
        ],
        { session },
      );

      await this.journal.post(
        {
          date,
          source: { type: PAYOUT_SOURCE, id: payout._id as Types.ObjectId, number: payout.payoutNumber, event: 'posted' },
          lines: [
            { account: ACCOUNT.CASH, debitMinor: netMinor, moneyAccount },
            { account: ACCOUNT.FEES, debitMinor: feeMinor },
            { account: ACCOUNT.GATEWAY_BALANCE, creditMinor: grossMinor },
          ],
          memo: memo('gateway_payout', { payout: payout.payoutNumber }),
          createdBy: userId,
        },
        session,
      );
      return payout;
    });
  }

  /** Undoes a payout recorded by mistake, with a reversing entry dated now. */
  async reverse(id: string, reason: string, userId?: string): Promise<GatewayPayout> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Payout not found');
    return withTransaction(this.connection, async (session) => {
      const payout = await this.payoutModel
        .findOneAndUpdate(
          { _id: id, status: PayoutStatus.POSTED },
          { $set: { status: PayoutStatus.REVERSED, reversedAt: new Date(), reversalReason: reason } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!payout) {
        const existing = await this.payoutModel.findById(id).select('status').session(session).lean().exec();
        if (!existing) throw new NotFoundException('Payout not found');
        throw new ConflictException(`A ${existing.status} payout can't be reversed`);
      }
      const original = await this.journal.findBySource(PAYOUT_SOURCE, payout._id as Types.ObjectId, 'posted', session);
      if (!original) throw new ConflictException(`Payout #${payout.payoutNumber} has no journal entry to reverse`);
      await this.journal.reverse(original, 'reversed', new Date(), session, userId, reason);
      return payout;
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
}
