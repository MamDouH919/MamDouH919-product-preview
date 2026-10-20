import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { CartReminderWorker } from './cart-reminder.worker';

const MINUTE = 60_000;

/**
 * Every few minutes, visits each store and sends reminders for carts left
 * alone longer than the delay. There's no request to hang tenant models on,
 * so each store gets its own DI context with a stand-in request carrying its
 * host — exactly what the tenant middleware would have set.
 *
 * Config (env): CART_REMINDER_DELAY_MINUTES (default 180),
 * CART_REMINDER_INTERVAL_MINUTES (default 15, 0 turns the job off).
 * Whether a store sends any is its own switch in Settings → Email.
 */
@Injectable()
export class CartReminderScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CartReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const interval = Number(this.config.get('CART_REMINDER_INTERVAL_MINUTES') ?? 15);
    if (!(interval > 0)) {
      this.logger.log('Cart reminders are off (CART_REMINDER_INTERVAL_MINUTES=0)');
      return;
    }
    this.timer = setInterval(() => void this.runAll(), interval * MINUTE);
    // `unref` so a pending run never keeps a shutting-down process alive.
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll(): Promise<void> {
    // A slow run (many stores, slow SMTP) must not overlap the next tick.
    if (this.running) return;
    this.running = true;
    const delayMs = Number(this.config.get('CART_REMINDER_DELAY_MINUTES') ?? 180) * MINUTE;

    try {
      for (const host of this.tenants.getStoreHosts()) {
        try {
          const contextId = ContextIdFactory.create();
          this.moduleRef.registerRequestByContextId({ hostname: host, tenant: host }, contextId);
          const worker = await this.moduleRef.resolve(CartReminderWorker, contextId, { strict: false });
          const sent = await worker.run(host, delayMs);
          if (sent) this.logger.log(`${host}: sent ${sent} cart reminder(s)`);
        } catch (error) {
          // One broken store (bad URI, mail misconfigured) never stops the rest.
          this.logger.warn(`${host}: cart reminders failed — ${(error as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
