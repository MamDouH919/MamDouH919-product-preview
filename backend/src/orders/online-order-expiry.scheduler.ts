import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { StoreModule } from '../common/tenant/store-plan';
import { OnlineOrderExpiryWorker } from './online-order-expiry.worker';

const MINUTE = 60_000;

/**
 * Every few minutes, visits each store that takes online payment and cancels
 * online orders left unpaid longer than the delay, so they stop holding stock.
 * Same shape as the cart reminders: each store gets its own DI context.
 *
 * Config (env): ONLINE_ORDER_EXPIRY_MINUTES (default 30),
 * ONLINE_ORDER_EXPIRY_INTERVAL_MINUTES (default 5, 0 turns the job off).
 */
@Injectable()
export class OnlineOrderExpiryScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OnlineOrderExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const interval = Number(this.config.get('ONLINE_ORDER_EXPIRY_INTERVAL_MINUTES') ?? 5);
    if (!(interval > 0)) {
      this.logger.log('Unpaid online order expiry is off (ONLINE_ORDER_EXPIRY_INTERVAL_MINUTES=0)');
      return;
    }
    this.timer = setInterval(() => void this.runAll(), interval * MINUTE);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Never shorter than a few minutes: a customer in the middle of 3-D Secure must not lose the order.
    const delayMs = Math.max(5, Number(this.config.get('ONLINE_ORDER_EXPIRY_MINUTES') ?? 30)) * MINUTE;

    try {
      for (const host of this.tenants.getStoreHosts()) {
        if (!this.tenants.hasModule(host, StoreModule.ONLINE_PAYMENTS)) continue;
        try {
          const contextId = ContextIdFactory.create();
          this.moduleRef.registerRequestByContextId({ hostname: host, tenant: host }, contextId);
          const worker = await this.moduleRef.resolve(OnlineOrderExpiryWorker, contextId, { strict: false });
          const cancelled = await worker.run(host, delayMs);
          if (cancelled) this.logger.log(`${host}: cancelled ${cancelled} unpaid online order(s)`);
        } catch (error) {
          this.logger.warn(`${host}: online order expiry failed — ${(error as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
