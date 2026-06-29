import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { Observable } from "rxjs";

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