import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, mongo, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { DatabaseService } from './database.service';
import { User } from '../auth/schemas/user.schema';

jest.setTimeout(120_000);

const HOST = 'shop.example';
const PASSWORD = 'correct horse';

describe('DatabaseService', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let service: DatabaseService;
  let superId: string;

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
    service = new DatabaseService(db, db.model<User>(User.name));
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all(db.modelNames().map((name) => db.model(name).deleteMany({})));
    const admin = await db.model('User').create({
      name: 'Owner',
      email: 'owner@shop.example',
      password: await bcrypt.hash(PASSWORD, 4),
      isSuper: true,
    });
    superId = String(admin._id);
    await db.model('Category').create({ name: { en: 'Tea', ar: 'شاي' }, slug: 'tea' });
    await db.model('RefreshToken').create({ token: 'live-session', userId: admin._id, expiryDate: new Date() });
  });

  const exported = async () => Buffer.from(await service.exportAll(superId, HOST));
  const options = (extra = {}) => ({ password: PASSWORD, confirm: HOST, dryRun: false, ...extra });

  it('exports real types and leaves credentials out', async () => {
    const parsed = mongo.BSON.EJSON.parse((await exported()).toString(), { relaxed: false });
    expect(parsed.host).toBe(HOST);
    expect(parsed.collections.refreshtokens).toBeUndefined();
    const [category] = parsed.collections.categories;
    expect(category._id).toBeInstanceOf(Types.ObjectId);
    expect(category.createdAt).toBeInstanceOf(Date);
  });

  it('refuses a non-super admin', async () => {
    const staff = await db.model('User').create({ name: 'S', email: 's@x', password: 'x', isSuper: false });
    await expect(service.exportAll(String(staff._id), HOST)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the password and the typed host', async () => {
    const file = await exported();
    await expect(service.importAll(superId, HOST, file, options({ password: 'wrong' }))).rejects.toThrow(
      'Password is incorrect',
    );
    await expect(service.importAll(superId, HOST, file, options({ confirm: 'other.example' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("refuses another store's export", async () => {
    const file = await exported();
    await expect(service.importAll(superId, 'other.example', file, options({ confirm: 'other.example' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses the old plain-JSON format', async () => {
    const file = Buffer.from(JSON.stringify({ categories: [] }));
    await expect(service.importAll(superId, HOST, file, options())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only checks the file on a dry run', async () => {
    const file = await exported();
    await db.model('Category').deleteMany({});
    const report = await service.importAll(superId, HOST, file, options({ dryRun: true }));
    expect(report).toMatchObject({ dryRun: true, imported: false, errors: [], blockers: [] });
    expect(await db.model('Category').countDocuments()).toBe(0);
  });

  it('restores the export with its ids and dates intact', async () => {
    const before = await db.model('Category').findOne().lean();
    const file = await exported();
    await db.model('Category').deleteMany({});

    const report = await service.importAll(superId, HOST, file, options());
    expect(report.imported).toBe(true);
    const after = await db.model('Category').findOne().lean();
    expect(after).toEqual(before);
  });

  it('refuses a store that already has orders, and writes nothing', async () => {
    const file = await exported();
    await db.model('Order').collection.insertOne({ orderNumber: 1001 });
    await db.model('Category').deleteMany({});

    await expect(service.importAll(superId, HOST, file, options())).rejects.toBeInstanceOf(ConflictException);
    expect(await db.model('Category').countDocuments()).toBe(0);
  });

  it('refuses a file that would lock the importer out', async () => {
    const file = await exported();
    await db.model('User').updateOne({ _id: superId }, { email: 'new-owner@shop.example' });
    const report = await service.importAll(superId, HOST, file, options({ dryRun: true }));
    expect(report.blockers.join()).toMatch(/lock you out/);
  });

  it('refuses a file with an invalid document, and writes nothing', async () => {
    const parsed = mongo.BSON.EJSON.parse((await exported()).toString(), { relaxed: false });
    parsed.collections.categories.push({ _id: new Types.ObjectId() }); // no name, no slug
    const file = Buffer.from(mongo.BSON.EJSON.stringify(parsed, { relaxed: false }));
    await db.model('Category').deleteMany({});

    await expect(service.importAll(superId, HOST, file, options())).rejects.toBeInstanceOf(ConflictException);
    expect(await db.model('Category').countDocuments()).toBe(0);
  });
});
