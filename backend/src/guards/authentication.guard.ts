import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { Types } from "mongoose";
import { CUSTOMER_TOKEN_TYPE } from "./customer-auth.guard";
import { TenantConnectionService } from "../common/helpers/dynamic-connection";
import { RefreshToken } from "../auth/schemas/refresh-schema.schema";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private tenantConnection: TenantConnectionService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      // An access token outlives logout unless it is tied to a live session:
      // logout deletes the user's refresh-token row, and that ends every token.
      if (!(await this.hasLiveSession(request, payload.userId, payload.sid))) {
        throw new UnauthorizedException("Invalid token");
      }
      request.userId = payload.userId;
      request.sessionId = payload.sid;
    } catch (error) {
      Logger.error(error);
      throw new UnauthorizedException("Invalid token");
    }
    return true;
  }

  private async hasLiveSession(request: Request, userId: string, sid?: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    if (sid !== undefined && !Types.ObjectId.isValid(sid)) return false;
    const connection = await this.tenantConnection.getConnection(request['tenant'] ?? request.hostname);
    // Tokens carry the session they belong to, so logging out on one device
    // ends that device only. Tokens minted before sessions existed have no
    // `sid` and fall back to "any live session for this user".
    const session = await connection.model(RefreshToken.name).exists({
      ...(sid ? { _id: new Types.ObjectId(sid) } : {}),
      userId: new Types.ObjectId(userId),
      expiryDate: { $gte: new Date() },
    });
    return !!session;
  }

  private extractTokenFromHeader(request: Request) {
    return request.headers.authorization?.split(" ")[1];
  }
}
