import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STORE_MODULES_KEY } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';

/**
 * Registered globally, so it runs before any controller's own guards: a route
 * from a module the store's plan leaves out answers 404, as if it weren't
 * there, to visitors and admins alike.
 */
@Injectable()
export class StoreModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenants: TenantConnectionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StoreModule[] | undefined>(STORE_MODULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const host: string = request.tenant ?? request.hostname;
    if (!required.every((module) => this.tenants.hasModule(host, module))) {
      throw new NotFoundException();
    }
    return true;
  }
}
