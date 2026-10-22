import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Marks a token as belonging to the platform admin, who manages tenants rather than one store. */
export const PLATFORM_TOKEN_TYPE = 'platform';

/**
 * Guards the platform dashboard's routes. A store token can't pass: it lacks
 * the `type: 'platform'` claim. A platform token can't pass the store guards
 * either, as it carries no `tenant`. The `sub` must still be the configured
 * admin email, so changing PLATFORM_ADMIN_EMAIL ends every platform session.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('Invalid token');

    let payload: { type?: string; sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
    if (payload.type !== PLATFORM_TOKEN_TYPE || !adminEmail || payload.sub !== adminEmail) {
      throw new UnauthorizedException('Invalid token');
    }
    request.platformAdmin = payload.sub;
    return true;
  }
}
