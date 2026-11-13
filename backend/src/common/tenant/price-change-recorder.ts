import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../helpers/dynamic-connection';
import type { PriceChangeInput } from './price-change-store';

/** What a service knows about a change; the host and who made it are filled in here. */
export type PriceChangeDraft = Omit<PriceChangeInput, 'host' | 'userId' | 'userName' | 'userEmail' | 'at'>;

/**
 * Passes price and cost changes on to the platform's log. Best effort and
 * never awaited: a store whose platform database is down, or isn't set up,
 * edits prices exactly as before.
 */
@Injectable()
export class PriceChangeRecorder {
  private readonly logger = new Logger(PriceChangeRecorder.name);

  constructor(private readonly tenants: TenantConnectionService) {}

  record(host: string | undefined, userId: string | undefined, drafts: PriceChangeDraft[]): void {
    if (!host || !drafts.length) return;
    void this.write(host, userId, drafts).catch((e: Error) => this.logger.warn(`Could not log price change: ${e.message}`));
  }

  private async write(host: string, userId: string | undefined, drafts: PriceChangeDraft[]): Promise<void> {
    const registry = this.tenants.findRegistry();
    if (!registry) return;
    const actor = userId ? await this.actor(host, userId) : {};
    await registry.priceChanges.record(
      drafts.map((draft) => ({
        ...draft,
        host: this.tenants.primaryHost(host),
        ...(userId ? { userId } : {}),
        ...actor,
      })),
    );
  }

  /** The name is looked up now, so the log still says who it was after the account is gone. */
  private async actor(host: string, userId: string): Promise<{ userName?: string; userEmail?: string }> {
    try {
      const connection = await this.tenants.getConnection(host);
      const user = await connection.model('User').findById(userId).select('name email').lean<{ name?: string; email?: string }>();
      return { ...(user?.name ? { userName: user.name } : {}), ...(user?.email ? { userEmail: user.email } : {}) };
    } catch {
      return {};
    }
  }
}
