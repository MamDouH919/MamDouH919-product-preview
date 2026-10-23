import { NotFoundException } from '@nestjs/common';
import { databaseKey, TenantConnectionService, validateTenantMap } from './dynamic-connection';
import { DEFAULT_PLAN, StoreModule, StorePlan } from '../tenant/store-plan';

const store = (db: string, extra = {}) => ({
  mongoUri: `mongodb://127.0.0.1:27017/${db}`,
  frontendUrl: 'http://x',
  ...extra,
});

describe('databaseKey', () => {
  it('ignores credentials, options and server order', () => {
    expect(databaseKey('mongodb://user:pw@B:1,a:2/shop?replicaSet=rs0')).toBe(databaseKey('mongodb://a:2,b:1/shop'));
  });

  it('tells databases on the same server apart', () => {
    expect(databaseKey('mongodb://h/one')).not.toBe(databaseKey('mongodb://h/two'));
  });
});

describe('validateTenantMap', () => {
  it('accepts one database per store', () => {
    expect(() => validateTenantMap({ 'a.com': store('a'), 'b.com': store('b') })).not.toThrow();
  });

  it('refuses two stores on one database', () => {
    expect(() => validateTenantMap({ 'a.com': store('a'), 'b.com': store('a') })).toThrow(/same database/);
  });

  it('accepts a declared alias on the same database', () => {
    expect(() =>
      validateTenantMap({ 'a.com': store('a'), 'www.a.com': store('a', { aliasOf: 'a.com' }) }),
    ).not.toThrow();
  });

  it('refuses an alias on a different database, of an unknown host, or of an alias', () => {
    expect(() => validateTenantMap({ 'a.com': store('a'), 'w.a.com': store('b', { aliasOf: 'a.com' }) })).toThrow(
      /different database/,
    );
    expect(() => validateTenantMap({ 'w.a.com': store('a', { aliasOf: 'a.com' }) })).toThrow(/unknown host/);
    expect(() =>
      validateTenantMap({
        'a.com': store('a'),
        'w.a.com': store('a', { aliasOf: 'a.com' }),
        'x.a.com': store('a', { aliasOf: 'w.a.com' }),
      }),
    ).toThrow(/alias of an alias/);
  });
});

describe('TenantConnectionService', () => {
  const original = process.env.TENANT_MAP;
  afterEach(() => {
    if (original === undefined) delete process.env.TENANT_MAP;
    else process.env.TENANT_MAP = original;
  });

  it('lists each store once for background jobs, aliases left out', () => {
    process.env.TENANT_MAP = JSON.stringify({
      'a.com': store('a'),
      'www.a.com': store('a', { aliasOf: 'a.com' }),
      'b.com': store('b'),
    });
    const service = new TenantConnectionService();
    expect(service.getStoreHosts()).toEqual(['a.com', 'b.com']);
    expect(service.getHosts()).toHaveLength(3);
  });

  it('refuses a map with two stores on one database', () => {
    process.env.TENANT_MAP = JSON.stringify({ 'a.com': store('a'), 'b.com': store('a') });
    expect(() => new TenantConnectionService().getHosts()).toThrow(/same database/);
  });

  it('resolves only hosts in the map', () => {
    process.env.TENANT_MAP = JSON.stringify({ 'a.com': store('a') });
    const service = new TenantConnectionService();
    expect(() => service.getTenantConfig('b.com')).toThrow(NotFoundException);
    expect(() => service.getTenantConfig('__proto__')).toThrow(NotFoundException);
  });

  it('gives each store its plan, an alias its primary host\'s, and a store without one everything', () => {
    process.env.TENANT_MAP = JSON.stringify({
      'a.com': store('a', { plan: StorePlan.CATALOG }),
      'www.a.com': store('a', { aliasOf: 'a.com', plan: StorePlan.FULL }),
      'b.com': store('b'),
    });
    const service = new TenantConnectionService();
    expect(service.getPlan('a.com')).toBe(StorePlan.CATALOG);
    expect(service.getPlan('www.a.com')).toBe(StorePlan.CATALOG);
    expect(service.hasModule('a.com', StoreModule.ORDERS)).toBe(false);
    expect(service.getPlan('b.com')).toBe(StorePlan.FULL);
    expect(service.hasModule('b.com', StoreModule.FINANCE)).toBe(true);
    expect(service.getPlan('__proto__')).toBe(DEFAULT_PLAN);
  });
});
