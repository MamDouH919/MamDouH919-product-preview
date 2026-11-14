import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { OrderStatus, PaymentMethod } from './enums/order-status.enum';
import { OrdersService } from './orders.service';

/** Orders handled per store per run, so one big store can't hog a run. */
const BATCH = 100;

/**
 * One store's pass over online orders nobody paid for. Request-scoped like the
 * rest of the tenant code: the scheduler resolves it per store with that
 * store's host standing in for a request.
 */
@Injectable()
export class OnlineOrderExpiryWorker {
  private readonly logger = new Logger(OnlineOrderExpiryWorker.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly orders: OrdersService,
  ) {}

  /** Cancels online orders still pending and unpaid after `delayMs`. Returns how many. */
  async run(host: string, delayMs: number): Promise<number> {
    const idleSince = new Date(Date.now() - delayMs);
    const stale = await this.orderModel
      .find({
        paymentMethod: PaymentMethod.ONLINE,
        status: OrderStatus.PENDING,
        createdAt: { $lt: idleSince },
        'money.collectedMinor': { $not: { $gt: 0 } },
      })
      .sort({ createdAt: 1 })
      .limit(BATCH)
      .select('_id')
      .lean()
      .exec();

    let cancelled = 0;
    for (const { _id } of stale) {
      try {
        if (await this.orders.expireUnpaidOnline(String(_id), host, idleSince)) cancelled++;
      } catch (error) {
        this.logger.warn(`${host}: could not expire order ${_id} — ${(error as Error).message}`);
      }
    }
    return cancelled;
  }
}
