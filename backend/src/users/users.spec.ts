import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { UsersService, Actor } from './users.service';
import { RolesService } from '../roles/roles.service';
import { User } from '../auth/schemas/user.schema';
import { Role } from '../roles/schemas/role.schema';
import { RefreshToken } from '../auth/schemas/refresh-schema.schema';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { PLAN_MODULES, StoreModule, StorePlan } from '../common/tenant/store-plan';
import { liveTenantMap, TenantConnectionService } from '../common/helpers/dynamic-connection';

jest.setTimeout(120_000);

const ALL = Object.values(Resource).map((resource) => ({ resource, actions: Object.values(Action) }));

describe('staff accounts and roles', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let users: UsersService;
  let roles: RolesService;
  let superActor: Actor;
  let adminActor: Actor;
  let managerActor: Actor;
  let superUserId: string;
  let adminUserId: string;
  let managerUserId: string;
  let managerRoleId: string;
  let cashierRoleId: string;
  let adminRoleId: string;
  let superRoleId: string;

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
    users = new UsersService(db.model<User>(User.name), db.model<Role>(Role.name), db.model<RefreshToken>(RefreshToken.name));
    roles = new RolesService(db.model<Role>(Role.name), db.model<User>(User.name));
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all(['User', 'Role', 'RefreshToken'].map((m) => db.model(m).deleteMany({})));
    const Role_ = db.model('Role');
    const User_ = db.model('User');
    superRoleId = String((await Role_.create({ name: 'super_admin', permissions: ALL }))._id);
    adminRoleId = String((await Role_.create({ name: 'admin', permissions: ALL }))._id);
    const managerPerms = [
      { resource: Resource.USERS, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE] },
      { resource: Resource.PRODUCTS, actions: [Action.READ] },
    ];
    managerRoleId = String((await Role_.create({ name: 'manager', permissions: managerPerms }))._id);
    cashierRoleId = String(
      (await Role_.create({ name: 'cashier', permissions: [{ resource: Resource.PRODUCTS, actions: [Action.READ] }] }))._id,
    );

    superUserId = String((await User_.create({ name: 'Owner', email: 'owner@x.com', password: 'x', isSuper: true, roleId: superRoleId }))._id);
    adminUserId = String((await User_.create({ name: 'Admin', email: 'admin@x.com', password: 'x', roleId: adminRoleId }))._id);
    managerUserId = String((await User_.create({ name: 'Manager', email: 'manager@x.com', password: 'x', roleId: managerRoleId }))._id);

    superActor = { userId: superUserId, isSuper: true, permissions: ALL };
    adminActor = { userId: adminUserId, isSuper: false, permissions: ALL };
    managerActor = { userId: managerUserId, isSuper: false, permissions: managerPerms };
  });

  describe('the super admin is hidden', () => {
    it('is left out of the user list, even for the admin', async () => {
      const list = await users.list();
      expect(list.map((u) => u.email).sort()).toEqual(['admin@x.com', 'manager@x.com']);
    });

    it('is left out when searched for by name', async () => {
      expect(await users.list('owner')).toEqual([]);
    });

    it('is also hidden when only the role marks it (isSuper not set)', async () => {
      await db.model('User').create({ name: 'Ghost', email: 'ghost@x.com', password: 'x', roleId: superRoleId });
      expect((await users.list()).map((u) => u.email)).not.toContain('ghost@x.com');
    });

    it('answers 404 by id, as if it did not exist', async () => {
      await expect(users.get(superUserId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(users.update(superUserId, { name: 'x' }, adminActor)).rejects.toBeInstanceOf(NotFoundException);
      await expect(users.remove(superUserId, adminActor)).rejects.toBeInstanceOf(NotFoundException);
      expect(await db.model('User').exists({ _id: superUserId })).toBeTruthy();
    });

    it('cannot be reached by handing out its role', async () => {
      await expect(
        users.create({ name: 'N', email: 'n@x.com', password: 'abcdefg1', roleId: superRoleId }, adminActor),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(users.update(managerUserId, { roleId: superRoleId }, adminActor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hides its role from the roles list and by id', async () => {
      const names = (await roles.getAllRoles()).map((r) => r.name);
      expect(names).toEqual(['admin', 'cashier', 'manager']);
      await expect(roles.getRoleById(superRoleId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(roles.deleteRole(superRoleId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(roles.updateRole(superRoleId, { name: 'x', permissions: [] })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still gets its permissions for the system, through the internal lookup', async () => {
      const role = await roles.getRoleForPermissions(superRoleId);
      expect(role.name).toBe('super_admin');
    });

    it('does not count super admins in role totals', async () => {
      const admin = (await roles.getAllRoles()).find((r) => r.name === 'admin');
      expect(admin?.usersCount).toBe(1);
    });
  });

  describe('creating and changing accounts', () => {
    it('creates a verified, active account with a hashed password', async () => {
      const created = await users.create({ name: ' Sara ', email: 'sara@x.com', password: 'abcdefg1', roleId: cashierRoleId }, adminActor);
      expect(created).toMatchObject({ name: 'Sara', email: 'sara@x.com', isActive: true, isVerified: true, role: { name: 'cashier' } });
      const stored = await db.model('User').findById(created._id).lean<{ password: string; isSuper: boolean }>();
      expect(stored?.password).not.toBe('abcdefg1');
      expect(stored?.isSuper).toBe(false);
      expect(JSON.stringify(created)).not.toContain('password');
    });

    it('refuses a duplicate email', async () => {
      await expect(
        users.create({ name: 'D', email: 'admin@x.com', password: 'abcdefg1', roleId: cashierRoleId }, adminActor),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets nobody hand out a role stronger than their own', async () => {
      await expect(
        users.create({ name: 'N', email: 'n@x.com', password: 'abcdefg1', roleId: adminRoleId }, managerActor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const ok = await users.create({ name: 'N', email: 'n@x.com', password: 'abcdefg1', roleId: cashierRoleId }, managerActor);
      expect(ok.role?.name).toBe('cashier');
    });

    it('keeps accounts with more access out of reach', async () => {
      await expect(users.update(adminUserId, { name: 'Hacked' }, managerActor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(users.remove(adminUserId, managerActor)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stops a user switching off, demoting or deleting themselves', async () => {
      await expect(users.update(managerUserId, { isActive: false }, managerActor)).rejects.toBeInstanceOf(BadRequestException);
      await expect(users.update(managerUserId, { roleId: cashierRoleId }, managerActor)).rejects.toBeInstanceOf(BadRequestException);
      await expect(users.remove(managerUserId, managerActor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ends the sessions of an account that is switched off', async () => {
      const staff = await users.create({ name: 'S', email: 's@x.com', password: 'abcdefg1', roleId: cashierRoleId }, adminActor);
      await db.model('RefreshToken').create({ token: 't', userId: staff._id, expiryDate: new Date(Date.now() + 1e6) });
      const updated = await users.update(staff._id, { isActive: false }, adminActor);
      expect(updated.isActive).toBe(false);
      expect(await db.model('RefreshToken').countDocuments({ userId: staff._id })).toBe(0);
    });

    it('deletes an account and its sessions', async () => {
      const staff = await users.create({ name: 'S', email: 's@x.com', password: 'abcdefg1', roleId: cashierRoleId }, adminActor);
      await db.model('RefreshToken').create({ token: 't', userId: staff._id, expiryDate: new Date(Date.now() + 1e6) });
      await users.remove(staff._id, adminActor);
      expect(await db.model('User').exists({ _id: staff._id })).toBeNull();
      expect(await db.model('RefreshToken').countDocuments({ userId: staff._id })).toBe(0);
    });
  });

  describe('roles', () => {
    it('refuses to delete a role that is still held', async () => {
      await expect(roles.deleteRole(managerRoleId)).rejects.toBeInstanceOf(ConflictException);
    });

    it('deletes an unused role', async () => {
      await roles.deleteRole(cashierRoleId);
      expect(await db.model('Role').exists({ _id: cashierRoleId })).toBeNull();
    });

    it('keeps the built-in admin role intact', async () => {
      await expect(roles.deleteRole(adminRoleId)).rejects.toBeInstanceOf(BadRequestException);
      await expect(roles.updateRole(adminRoleId, { name: 'x', permissions: [] })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a name taken without regard to case, including the reserved ones', async () => {
      await expect(roles.createRole({ name: 'ADMIN', permissions: [] })).rejects.toBeInstanceOf(ConflictException);
      await expect(roles.createRole({ name: 'Super_Admin', permissions: [] })).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

describe('the staff add-on is a paid switch', () => {
  const record = (team?: boolean) => ({
    host: 'api.shop.com',
    mongoUri: 'mongodb://127.0.0.1/shop',
    frontendUrl: 'https://shop.com',
    disabled: false,
    plan: StorePlan.CATALOG,
    ...(team === undefined ? {} : { team }),
  });
  const service = (team?: boolean) => {
    const svc = new TenantConnectionService();
    (svc as unknown as { tenantMap: unknown }).tenantMap = liveTenantMap([record(team)]);
    return svc;
  };

  it('is off unless the platform turns it on', () => {
    expect(service().getModules('api.shop.com')).toEqual(PLAN_MODULES[StorePlan.CATALOG]);
    expect(service(false).hasModule('api.shop.com', StoreModule.TEAM)).toBe(false);
  });

  it('adds to whatever the plan gives, on any plan', () => {
    expect(service(true).getModules('api.shop.com')).toEqual([StoreModule.TEAM]);
  });

  it('is not part of any plan', () => {
    for (const modules of Object.values(PLAN_MODULES)) expect(modules).not.toContain(StoreModule.TEAM);
  });
});
