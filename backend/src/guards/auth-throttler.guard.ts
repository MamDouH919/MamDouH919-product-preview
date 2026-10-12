import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiter for credential endpoints (login, register, password reset).
 *
 * The bucket is keyed by tenant + client IP + submitted email rather than IP
 * alone. Behind a reverse proxy every request can arrive from the proxy's IP,
 * and an IP-only key would then make all shoppers of a store share one bucket —
 * one attacker would lock everyone out. Folding in the email keeps brute force
 * against a single account (or reset-email bombing of one address) capped no
 * matter where the request appears to come from.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const tenant = req.tenant ?? req.hostname ?? '';
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    return `${tenant}|${req.ip}|${email}`;
  }
}
