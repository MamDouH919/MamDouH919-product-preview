import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { SettingsService } from './settings.service';
import { Setting } from './schemas/setting.schema';
import { User } from '../auth/schemas/user.schema';
import { Order } from '../orders/schemas/order.schema';

jest.setTimeout(120_000);

describe('SettingsService: currency and time zone', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let settings: SettingsService;
  let superId: string;
  let staffId: string;

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
    settings = new SettingsService(
      db.model<Setting>(Setting.name),
      db.model<User>(User.name),
      db.model<Order>(Order.name),
      {} as never,
    );
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all(['Setting', 'User', 'Order'].map((m) => db.model(m).deleteMany({})));
    superId = String((await db.model('User').create({ name: 'O', email: 'o@x', password: 'x', isSuper: true }))._id);
    staffId = String((await db.model('User').create({ name: 'S', email: 's@x', password: 'x' }))._id);
  });

  it('defaults to EGP and Africa/Cairo', async () => {
    const current = await settings.get();
    expect(current.currencyCode).toBe('EGP');
    expect(current.timezone).toBe('Africa/Cairo');
  });

  it("lets only the store's Super Admin change them", async () => {
    await expect(settings.update({ timezone: 'Africa/Cairo' }, {}, staffId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(settings.update({ currencyCode: 'EGP' }, {}, staffId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(settings.update({ timezone: 'Asia/Dubai' }, {}, superId)).resolves.toMatchObject({
      timezone: 'Asia/Dubai',
    });
  });

  it('refuses an unknown zone or currency', async () => {
    await expect(settings.update({ timezone: 'Mars/Olympus' }, {}, superId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(settings.update({ currencyCode: 'XXX' }, {}, superId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still lets any admin edit the other settings', async () => {
    await expect(settings.update({ phone: '0100' }, {}, staffId)).resolves.toMatchObject({ phone: '0100' });
  });

  it('freezes the currency once the store has orders', async () => {
    await db.model('Order').collection.insertOne({ orderNumber: 1001 });
    // Re-sending the current code is harmless; changing it is not.
    await expect(settings.update({ currencyCode: 'EGP' }, {}, superId)).resolves.toBeDefined();
    await db.model('Setting').updateOne({}, { currencyCode: 'USD' }, { upsert: true, strict: false });
    await expect(settings.update({ currencyCode: 'EGP' }, {}, superId)).rejects.toThrow(/cannot change/);
  });
});
