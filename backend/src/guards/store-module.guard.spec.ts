import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoreModuleGuard } from './store-module.guard';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule, StorePlan } from '../common/tenant/store-plan';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';

@RequireModules(StoreModule.ORDERS, StoreModule.FINANCE)
@Controller('x')
class GatedController {
  @Get()
  route() {}
}

@Controller('y')
class OpenController {
  @Get()
  route() {}
}

const contextFor = (controller: new () => { route(): void }, host: string) =>
  ({
    getHandler: () => controller.prototype.route,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ tenant: host, hostname: host }) }),
  }) as unknown as ExecutionContext;

describe('StoreModuleGuard', () => {
  const original = process.env.TENANT_MAP;
  afterEach(() => {
    if (original === undefined) delete process.env.TENANT_MAP;
    else process.env.TENANT_MAP = original;
  });

  const guard = () => {
    process.env.TENANT_MAP = JSON.stringify({
      'shop.com': { mongoUri: 'mongodb://h/shop', frontendUrl: 'http://x', plan: StorePlan.FULL },
      'show.com': { mongoUri: 'mongodb://h/show', frontendUrl: 'http://x', plan: StorePlan.CATALOG },
    });
    return new StoreModuleGuard(new Reflector(), new TenantConnectionService());
  };

  it('lets a store whose plan has every required module through', () => {
    expect(guard().canActivate(contextFor(GatedController, 'shop.com'))).toBe(true);
  });

  it('answers 404 on a store whose plan leaves a module out', () => {
    expect(() => guard().canActivate(contextFor(GatedController, 'show.com'))).toThrow(NotFoundException);
  });

  it('leaves routes without a module alone', () => {
    expect(guard().canActivate(contextFor(OpenController, 'show.com'))).toBe(true);
  });
});
