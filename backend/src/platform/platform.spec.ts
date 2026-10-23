import { BadRequestException, ConflictException, ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { startReplSet } from '../../test/helpers/replset';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { PlatformAuthGuard } from '../guards/platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { StoreModule, StorePlan } from '../common/tenant/store-plan';

jest.setTimeout(120_000);

const env = { ...process.env };
afterAll(() => {
  process.env = env;
});

const httpContext = (request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` }, hostname: 'shop.example' });

describe('Platform auth', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const auth = new PlatformAuthService(jwt);
  const guard = new PlatformAuthGuard(jwt);

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_EMAIL = 'Owner@Platform.test';
    process.env.PLATFORM_ADMIN_PASSWORD_HASH = await bcrypt.hash('correct horse', 4);
  });

  it('logs the configured admin in, case-insensitively by email', async () => {
    const { accessToken } = await auth.login({ email: 'owner@platform.test', password: 'correct horse' });
    expect(guard.canActivate(httpContext(bearer(accessToken)))).toBe(true);
  });

  it('refuses a wrong email or password', async () => {
    await expect(auth.login({ email: 'owner@platform.test', password: 'nope' })).rejects.toThrow(UnauthorizedException);
    await expect(auth.login({ email: 'other@platform.test', password: 'correct horse' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('turns away store tokens, and store guards turn away platform tokens', async () => {
    const storeToken = jwt.sign({ userId: 'u1', tenant: 'shop.example' });
    expect(() => guard.canActivate(httpContext(bearer(storeToken)))).toThrow(UnauthorizedException);

    const { accessToken } = await auth.login({ email: 'owner@platform.test', password: 'correct horse' });
    const storeGuard = new AuthenticationGuard(jwt, {} as TenantConnectionService);
    await expect(storeGuard.canActivate(httpContext(bearer(accessToken)))).rejects.toThrow(UnauthorizedException);
  });

  it('ends platform sessions when the admin email changes', async () => {
    const { accessToken } = await auth.login({ email: 'owner@platform.test', password: 'correct horse' });
    process.env.PLATFORM_ADMIN_EMAIL = 'new-owner@platform.test';
    expect(() => guard.canActivate(httpContext(bearer(accessToken)))).toThrow(UnauthorizedException);
    process.env.PLATFORM_ADMIN_EMAIL = 'owner@platform.test';
  });
});

describe('Tenant registry', () => {
  let replSet: MongoMemoryReplSet;
  let tenants: TenantConnectionService;
  let service: PlatformTenantsService;
  const store = (db: string) => replSet.getUri(db);

  beforeAll(async () => {
    replSet = await startReplSet();
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.PLATFORM_MONGO_URL = store('platform');
    process.env.TENANT_MAP = JSON.stringify({ 'legacy.test': { mongoUri: store('legacy'), frontendUrl: 'http://legacy.test' } });

    tenants = new TenantConnectionService();
    await tenants.onModuleInit();
    service = new PlatformTenantsService(tenants);
  });

  afterAll(async () => {
    await tenants?.onModuleDestroy();
    await replSet?.stop();
  });

  it('imports TENANT_MAP into an empty registry once, and serves it', async () => {
    expect(tenants.getHosts()).toEqual(['legacy.test']);
    expect(tenants.getTenantConfig('legacy.test').mongoUri).toBe(store('legacy'));
  });

  it('adds a store that resolves and is allowed by CORS without a restart', async () => {
    const view = await service.create({ host: 'shop.test', mongoUri: store('shop'), frontendUrl: 'http://shop.test/' });
    expect(view.frontendUrl).toBe('http://shop.test');
    expect(tenants.getTenantConfig('shop.test').mongoUri).toBe(store('shop'));
    expect(tenants.getAllowedOrigins()).toContain('http://shop.test');
  });

  it('keeps connection strings encrypted at rest', async () => {
    const raw = await mongoose.createConnection(store('platform')).asPromise();
    const doc = await raw.db!.collection('tenants').findOne({ host: 'shop.test' });
    await raw.close();
    expect(doc!.mongoUri).toMatch(/^v1:/);
    expect(doc!.mongoUri).not.toContain('shop');
  });

  it('refuses a second store on the same database, or on the registry database', async () => {
    await expect(
      service.create({ host: 'copy.test', mongoUri: store('shop'), frontendUrl: 'http://copy.test' }),
    ).rejects.toThrow(/same database/);
    await expect(
      service.create({ host: 'sneaky.test', mongoUri: store('platform'), frontendUrl: 'http://sneaky.test' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({ host: 'shop.test', mongoUri: store('other'), frontendUrl: 'http://shop.test' }),
    ).rejects.toThrow(ConflictException);
  });

  it('hides a disabled store and its aliases, and brings them back', async () => {
    await service.create({ host: 'www.shop.test', mongoUri: store('shop'), frontendUrl: 'http://www.shop.test', aliasOf: 'shop.test' });
    await service.update('shop.test', { disabled: true });
    expect(() => tenants.getTenantConfig('shop.test')).toThrow(NotFoundException);
    expect(() => tenants.getTenantConfig('www.shop.test')).toThrow(NotFoundException);

    await service.update('shop.test', { disabled: false });
    expect(tenants.getStoreHosts()).toContain('shop.test');
    expect(tenants.getHosts()).toContain('www.shop.test');
  });

  it('gives a new store every module, and changes its plan in place for it and its aliases', async () => {
    expect(tenants.getPlan('legacy.test')).toBe(StorePlan.FULL);
    expect((await service.list()).find((t) => t.host === 'shop.test')!.plan).toBe(StorePlan.FULL);

    const view = await service.update('shop.test', { plan: StorePlan.CATALOG });
    expect(view.plan).toBe(StorePlan.CATALOG);
    expect(tenants.hasModule('shop.test', StoreModule.ORDERS)).toBe(false);
    expect(tenants.hasModule('www.shop.test', StoreModule.ORDERS)).toBe(false);

    await service.update('shop.test', { mongoUri: store('shop') });
    expect(tenants.getPlan('shop.test')).toBe(StorePlan.CATALOG);
    await service.update('shop.test', { plan: StorePlan.FULL });
    expect(tenants.hasModule('shop.test', StoreModule.ORDERS)).toBe(true);
  });

  it('refuses to delete a store that still has aliases', async () => {
    await expect(service.remove('shop.test')).rejects.toThrow(/aliases first/);
    await service.remove('www.shop.test');
    await service.remove('shop.test');
    expect(tenants.getHosts()).toEqual(['legacy.test']);
  });

  it('never returns credentials', async () => {
    await service.create({
      host: 'secret.test',
      mongoUri: store('secret').replace('mongodb://', 'mongodb://user:hunter2@'),
      frontendUrl: 'http://secret.test',
    });
    const views = await service.list();
    expect(JSON.stringify(views)).not.toContain('hunter2');
    expect(views.find((v) => v.host === 'secret.test')!.database).toMatch(/^mongodb:\/\/\*\*\*@/);
    await service.remove('secret.test');
  });

  it('checks and seeds a store database', async () => {
    const seeded = await service.seed('legacy.test', {
      admin: { name: 'Admin', email: 'admin@legacy.test', password: 'password1' },
      superAdmin: { name: 'Super', email: 'super@legacy.test', password: 'password2' },
    });
    expect(seeded.log).toContain('Admin user created (admin@legacy.test)');

    const again = await service.seed('legacy.test', {
      admin: { name: 'Admin', email: 'admin@legacy.test', password: 'password1' },
    });
    expect(again.log).toContain('Admin user already exists (admin@legacy.test)');

    const check = await service.check('legacy.test');
    expect(check).toMatchObject({ ok: true, transactions: true, users: 2 });
  });
});
