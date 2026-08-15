import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { Observable } from "rxjs";
import { CUSTOMER_TOKEN_TYPE } from "./customer-auth.guard";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private jwtService: JwtService) { }
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException("Invalid token");
    }
    try {
      const payload = this.jwtService.verify(token);
      // Bind the token to the tenant that issued it. The JWT secret is shared
      // across tenants, so without this a token from one tenant would pass
      // signature verification on another (cross-tenant impersonation).
      if (payload.tenant !== request.hostname) {
        throw new UnauthorizedException("Invalid token");
      }
      // Storefront customer tokens are signed with the same secret, so they
      // must be turned away explicitly — otherwise a customer could reach admin
      // routes and be judged only by whatever role lookup follows.
      if (payload.type === CUSTOMER_TOKEN_TYPE) {
        throw new UnauthorizedException("Invalid token");
      }
      request.userId = payload.userId;
    } catch (error) {
      Logger.error(error);
      throw new UnauthorizedException("Invalid token");
    }
    return true;
  }


  private extractTokenFromHeader(request: Request) {
    return request.headers.authorization?.split(" ")[1];
  }
}