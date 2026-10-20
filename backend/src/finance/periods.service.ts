import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Setting } from '../settings/schemas/setting.schema';
import { User } from '../auth/schemas/user.schema';
import { ReconciliationService } from './reconciliation.service';
import { FinanceReportsService } from './finance-reports.service';
import { dayKey, zonedDayRange } from '../common/helpers/time-zone';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Closing periods. Once a day is locked, nothing can be posted with a date on
 * or before it, so figures already reported stay as they were; a correction
 * goes into an open period instead. Each store's own super admin decides,
 * and only once the books reconcile.
 */
@Injectable()
export class PeriodsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly reconciliation: ReconciliationService,
    private readonly reports: FinanceReportsService,
  ) {}

  async get() {
    const settings = await this.settingModel.findOne().select('finance').lean().exec();
    const { timeZone, booksStartedAt } = await this.reports.storeClock();
    return {
      timeZone,
      booksStartedAt,
      lockedThroughDay: settings?.finance?.lockedThroughDay ?? null,
      history: (settings?.finance?.history ?? []).filter((h) => h.field === 'lockedThroughDay').slice(-20),
    };
  }

  /**
   * Closes everything through `day` (inclusive, store time). Only forward,
   * never today or later, and only when every reconciliation check passes —
   * a period should not be frozen with a break in it.
   */
  async lock(day: string, userId?: string) {
    await this.assertSuper(userId);
    if (!DAY.test(day)) throw new BadRequestException('Give the last day to close as YYYY-MM-DD');
    const { timeZone } = await this.reports.storeClock();
    const today = dayKey(new Date(), timeZone);
    if (day >= today) throw new BadRequestException('Only days that are over can be closed');

    const current = (await this.get()).lockedThroughDay;
    if (current && day <= current) throw new ConflictException(`The books are already closed through ${current}`);

    const report = await this.reconciliation.run();
    if (!report.ok) {
      const broken = report.checks.filter((c) => !c.ok).map((c) => c.name);
      throw new ConflictException({ message: 'The books must reconcile before a period is closed', broken });
    }
    return this.set(day, timeZone, current, userId);
  }

  /**
   * Reopens days already closed, back to `day` (or entirely, with none).
   * Rare and deliberate, so it needs a reason, which is kept with the change.
   */
  async reopen(day: string | undefined, reason: string, userId?: string) {
    await this.assertSuper(userId);
    if (!reason?.trim()) throw new BadRequestException('Say why the period is being reopened');
    if (day !== undefined && !DAY.test(day)) throw new BadRequestException('Give the new last closed day as YYYY-MM-DD');
    const { timeZone } = await this.reports.storeClock();
    const current = (await this.get()).lockedThroughDay;
    if (!current) throw new BadRequestException('No period is closed');
    if (day && day >= current) throw new BadRequestException(`Pick a day before ${current} to reopen anything`);
    return this.set(day ?? null, timeZone, current, userId, reason.trim());
  }

  private async set(day: string | null, timeZone: string, from: string | null, userId?: string, reason?: string) {
    // The last instant of `day` in the store's zone: postings dated on or before it are refused.
    const lockedThrough = day ? new Date(zonedDayRange(undefined, day, timeZone).end!.getTime() - 1) : null;
    await this.settingModel
      .updateOne(
        {},
        {
          $set: { 'finance.lockedThrough': lockedThrough, 'finance.lockedThroughDay': day },
          $push: {
            'finance.history': {
              field: 'lockedThroughDay',
              from,
              to: reason ? { day, reason } : day,
              by: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
              at: new Date(),
            },
          },
        },
        { upsert: true },
      )
      .exec();
    return this.get();
  }

  private async assertSuper(userId?: string) {
    const user = userId ? await this.userModel.findById(userId).select('isSuper').lean().exec() : null;
    if (!user?.isSuper) throw new ForbiddenException("Only this store's super admin can close or reopen periods");
  }
}
