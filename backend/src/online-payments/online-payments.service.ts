import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { STORE_MODULES, TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { StoreModule } from '../common/tenant/store-plan';
import { withTransaction } from '../common/tenant/with-transaction';
import { Order } from '../orders/schemas/order.schema';
import { GatewayRefundState, Payment } from '../finance/schemas/payment.schema';
import { OrderStatus, PaymentMethod } from '../orders/enums/order-status.enum';
import { Customer } from '../customers/schemas/customer.schema';
import { PaymentsService } from '../finance/payments.service';
import { orderAmounts } from '../finance/order-money';
import { AttemptStatus, PaymentAttempt } from './schemas/payment-attempt.schema';
import { GatewaySettingsService } from './gateway-settings.service';
import { getProvider } from './providers';
import { WebhookEvent, WebhookRequest } from './providers/payment-provider';

export interface CheckoutContext {
  /** The API's public origin as this request reached it — the gateway calls back on the same host, which picks the store. */
  apiOrigin: string;
  /** Where the customer is sent after paying. */
  returnUrl: string;
}

@Injectable()
export class OnlinePaymentsService {
  private readonly logger = new Logger(OnlinePaymentsService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(PaymentAttempt.name) private attemptModel: Model<PaymentAttempt>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    @Inject(STORE_MODULES) private readonly modules: readonly StoreModule[],
    private readonly gateway: GatewaySettingsService,
    private readonly payments: PaymentsService,
  ) {}

  /** Whether a customer may choose online payment right now. */
  async isAvailable(): Promise<boolean> {
    return this.modules.includes(StoreModule.ONLINE_PAYMENTS) && (await this.gateway.isAvailable());
  }

  /** Refuses an online order the store can't take payment for. */
  async assertAvailable(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new BadRequestException('Online payment is not available in this store. Please choose another way to pay.');
    }
  }

  /**
   * Opens a checkout at the gateway for what the order still owes and returns
   * where to send the customer. Safe to call again for the same order (a
   * failed card, an abandoned page): each call is its own attempt.
   */
  async startCheckout(order: Order, ctx: CheckoutContext): Promise<{ paymentUrl: string }> {
    if (order.paymentMethod !== PaymentMethod.ONLINE) throw new BadRequestException('This order is not paid online');
    if (order.status === OrderStatus.CANCELLED) throw new ConflictException('This order was cancelled');
    const { totalMinor } = orderAmounts(order);
    const owed = totalMinor - (order.money?.collectedMinor ?? 0);
    if (owed <= 0) throw new ConflictException('This order is already paid');

    const { provider, credentials } = await this.gateway.active();
    const customer = await this.customerModel.findById(order.customer).select('email').lean().exec();
    const currencyCode = order.currencyCode ?? (await this.gateway.currencyCode());

    const attempt = await this.attemptModel.create({
      order: order._id,
      provider: provider.id,
      reference: randomUUID(),
      amountMinor: owed,
      currencyCode,
    });

    try {
      const { checkoutUrl } = await provider.createCheckout(credentials, {
        reference: attempt.reference,
        amountMinor: owed,
        currencyCode,
        orderNumber: order.orderNumber,
        customer: { name: order.shippingAddress.fullName, email: customer?.email, phone: order.shippingAddress.phone },
        notificationUrl: `${ctx.apiOrigin}/online-payments/webhook/${provider.id}`,
        returnUrl: ctx.returnUrl,
      });
      return { paymentUrl: checkoutUrl };
    } catch (error) {
      await this.attemptModel.updateOne({ _id: attempt._id }, { status: AttemptStatus.FAILED, note: 'Could not open the checkout' }).exec();
      throw error;
    }
  }

  /** Opens a throwaway checkout to prove the keys work (the settings page's "Test" button). */
  async testKeys(providerId: string | undefined, entered: Record<string, string> | undefined, ctx: CheckoutContext) {
    const { provider, credentials } = await this.gateway.draft(providerId, entered);
    provider.assertCredentials(credentials);
    await provider.createCheckout(credentials, {
      reference: `test-${randomUUID()}`,
      amountMinor: 100,
      currencyCode: await this.gateway.currencyCode(),
      orderNumber: 0,
      customer: { name: 'Test' },
      notificationUrl: `${ctx.apiOrigin}/online-payments/webhook/${provider.id}`,
      returnUrl: ctx.returnUrl,
    });
    return { ok: true };
  }

  /**
   * A gateway's notice. Nothing in it is believed until the provider has
   * verified its signature. Idempotent: gateways repeat notices, and a repeat
   * must not book the money twice.
   */
  async handleWebhook(providerId: string, request: WebhookRequest): Promise<void> {
    const known = getProvider(providerId);
    const found = await this.gateway.forWebhook(known.id);
    if (!found) throw new NotFoundException();

    const event = found.provider.parseWebhook(found.credentials, request);
    await this.applyEvent(known.id, found, event);
  }

  /**
   * For an order the customer is waiting on: asks the gateway what became of
   * its open checkouts, in case the notice was late or lost, and settles
   * those it says were paid exactly as the notice would have. Safe to repeat.
   */
  async syncOrder(order: Order): Promise<void> {
    if (order.paymentMethod !== PaymentMethod.ONLINE || order.status === OrderStatus.CANCELLED) return;
    const attempts = await this.attemptModel
      .find({ order: order._id, status: { $in: [AttemptStatus.PENDING, AttemptStatus.FAILED] } })
      .sort({ createdAt: -1 })
      .limit(3)
      .exec();
    for (const attempt of attempts) {
      const found = await this.gateway.forWebhook(attempt.provider);
      if (!found?.provider.inquire) continue;
      const event = await found.provider.inquire(found.credentials, attempt.reference);
      // Only a confirmed payment is acted on here; a failure stays for the customer to retry.
      if (event.kind === 'paid') await this.applyEvent(attempt.provider, found, event);
    }
  }

  private async applyEvent(
    providerId: string,
    found: NonNullable<Awaited<ReturnType<GatewaySettingsService['forWebhook']>>>,
    event: WebhookEvent,
  ): Promise<void> {
    if (event.kind === 'ignored') return;
    const known = { id: providerId };

    const attempt = await this.attemptModel.findOne({ reference: event.reference }).exec();
    if (!attempt) {
      this.logger.warn(`${known.id} notice for unknown reference ${event.reference}`);
      return;
    }

    if (event.kind === 'failed') {
      await this.attemptModel
        .updateOne(
          { _id: attempt._id, status: AttemptStatus.PENDING },
          { status: AttemptStatus.FAILED, providerTransactionId: event.transactionId },
        )
        .exec();
      return;
    }

    const keepsBooks = this.modules.includes(StoreModule.FINANCE);
    // Set when the money arrived for an order that was cancelled meanwhile: it goes straight back.
    let returnToCustomer = false;
    await withTransaction(this.connection, async (session) => {
      // Claim the attempt first: the second of two simultaneous notices finds nothing to claim.
      const claimed = await this.attemptModel
        .findOneAndUpdate(
          { _id: attempt._id, status: { $in: [AttemptStatus.PENDING, AttemptStatus.FAILED] } },
          { status: AttemptStatus.SUCCEEDED, providerTransactionId: event.transactionId },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!claimed) return;

      const order = await this.orderModel.findById(claimed.order).session(session).exec();
      const problem = !order
        ? 'order is gone'
        : event.amountMinor !== claimed.amountMinor || (event.currencyCode && event.currencyCode !== claimed.currencyCode)
          ? `gateway reported ${event.amountMinor} ${event.currencyCode}, expected ${claimed.amountMinor} ${claimed.currencyCode}`
          : order.status === OrderStatus.CANCELLED
            ? 'order was cancelled before the payment arrived'
            : undefined;
      if (problem) {
        // Money the gateway took that we can't attach to an order: keep the facts, book nothing, let staff decide.
        this.logger.error(`Payment ${event.transactionId} needs review (attempt ${claimed.reference}): ${problem}`);
        returnToCustomer = order?.status === OrderStatus.CANCELLED && event.amountMinor === claimed.amountMinor;
        await this.attemptModel
          .updateOne({ _id: claimed._id }, { status: AttemptStatus.NEEDS_REVIEW, note: problem }, { session })
          .exec();
        return;
      }

      await this.payments.recordGatewayPayment(
        String(order!._id),
        { amountMinor: event.amountMinor, provider: known.id, transactionId: event.transactionId, keepsBooks },
        session,
      );
    });

    if (returnToCustomer) await this.returnLatePayment(attempt._id as Types.ObjectId, found, event.transactionId, event.amountMinor);
  }

  /** Money that reached a cancelled order was never booked, so there is nothing to undo — only to send back. */
  private async returnLatePayment(
    attemptId: Types.ObjectId,
    gateway: Awaited<ReturnType<GatewaySettingsService['forWebhook']>> & object,
    transactionId: string,
    amountMinor: number,
  ): Promise<void> {
    try {
      await gateway.provider.refund(gateway.credentials, { transactionId, amountMinor });
      await this.attemptModel
        .updateOne({ _id: attemptId }, { status: AttemptStatus.REFUNDED, note: 'Order was cancelled; refunded automatically' })
        .exec();
    } catch (error) {
      // Stays NEEDS_REVIEW with the reason on it; staff can refund from the gateway's dashboard.
      this.logger.error(`Automatic refund of ${transactionId} failed: ${(error as Error).message}`);
      await this.attemptModel
        .updateOne({ _id: attemptId }, { note: `Order was cancelled; automatic refund failed: ${(error as Error).message}`.slice(0, 300) })
        .exec();
    }
  }

  /** A cancelled order's online payments go back to the customer, each through the gateway that took it. */
  async refundCancelled(orderId: Types.ObjectId): Promise<void> {
    const pending = await this.paymentModel
      .find({ order: orderId, refundState: GatewayRefundState.PENDING })
      .select('_id')
      .lean()
      .exec();
    for (const { _id } of pending) {
      await this.refundPayment(_id as Types.ObjectId).catch((error: Error) =>
        // Already recorded on the payment as failed; the cancellation itself stands.
        this.logger.warn(`Refund of payment ${_id} did not go through: ${error.message}`),
      );
    }
  }

  /**
   * Asks the gateway to send one payment back, then lets the books go of it.
   * Claimed first, so two clicks (or a retry racing the automatic try) can't
   * refund twice. A failed try can be repeated; one that died mid-way sits as
   * "processing" until staff check the gateway.
   */
  async refundPayment(paymentId: Types.ObjectId | string): Promise<void> {
    const claimed = await this.paymentModel
      .findOneAndUpdate(
        { _id: paymentId, custody: 'gateway', refundState: { $in: [GatewayRefundState.PENDING, GatewayRefundState.FAILED] } },
        { $set: { refundState: GatewayRefundState.PROCESSING } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!claimed) throw new ConflictException('This payment has nothing waiting to be refunded');

    try {
      const found = await this.gateway.forWebhook(claimed.provider ?? '');
      if (!found || !claimed.providerTransactionId) throw new Error('The gateway keys for this payment are no longer saved');
      await found.provider.refund(found.credentials, { transactionId: claimed.providerTransactionId, amountMinor: claimed.amountMinor });
    } catch (error) {
      await this.paymentModel
        .updateOne({ _id: claimed._id }, { $set: { refundState: GatewayRefundState.FAILED, refundNote: (error as Error).message.slice(0, 300) } })
        .exec();
      throw error;
    }

    try {
      await withTransaction(this.connection, (session) => this.payments.finishGatewayRefund(claimed._id as Types.ObjectId, session));
    } catch (error) {
      // The customer has their money; our books don't know yet. Needs a person.
      this.logger.error(`Payment ${claimed._id} was refunded at the gateway but not recorded: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Sends `amountMinor` of one online payment back through the gateway that
   * took it. Only talks to the gateway: the caller owns the books and the state.
   */
  async sendRefund(paymentId: Types.ObjectId | string, amountMinor: number): Promise<void> {
    const payment = await this.paymentModel.findOne({ _id: paymentId, custody: 'gateway' }).exec();
    if (!payment?.providerTransactionId) throw new Error('That is not an online payment');
    const found = await this.gateway.forWebhook(payment.provider ?? '');
    if (!found) throw new Error('The gateway keys for this payment are no longer saved');
    await found.provider.refund(found.credentials, { transactionId: payment.providerTransactionId, amountMinor });
  }

  /** Whether a checkout was opened for the order since `since` — a customer who may still be paying. */
  async hasAttemptSince(orderId: Types.ObjectId, since: Date): Promise<boolean> {
    return !!(await this.attemptModel.exists({ order: orderId, createdAt: { $gte: since } }).exec());
  }

  /** The status of an order's latest attempt, for the page the customer lands on. */
  async attemptsFor(orderId: Types.ObjectId) {
    return this.attemptModel.find({ order: orderId }).sort({ createdAt: -1 }).limit(5).select('status provider amountMinor createdAt note').lean().exec();
  }
}
