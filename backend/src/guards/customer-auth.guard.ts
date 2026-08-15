import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/** Marks a token as belonging to a storefront customer, not an admin user. */
export const CUSTOMER_TOKEN_TYPE = 'customer';

/**
 * Authenticates storefront customers. Deliberately separate from
 * `AuthenticationGuard`: it requires the `type: 'customer'` claim, so an admin
 * token can never satisfy a customer route and — more importantly — the admin
 * guard rejects anything carrying this claim, so the reverse cannot happen
 * either. Both guards also pin the token to the tenant that issued it.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== CUSTOMER_TOKEN_TYPE) {
        throw new UnauthorizedException('Invalid token');
      }

      // The JWT secret is shared across tenants, so without this a token minted
      // on one storefront would verify on another.
      if (payload.tenant !== request.hostname) {
        throw new UnauthorizedException('Invalid token');
      }

      request.customerId = payload.customerId;
    } catch (error) {
      Logger.error(error);
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request) {
    return request.headers.authorization?.split(' ')[1];
  }
}
