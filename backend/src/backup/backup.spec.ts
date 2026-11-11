import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, mongo, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { dumpStore, RestoreError, restoreStore } from './store-dump';
import { backupId, parseBackupId } from './backup-storage';
import { msUntilMidnight } from './backup.scheduler';

jest.setTimeout(120_000);

const HOST = 'shop.example';
const { EJSON } = mongo.BSON;

describe('store dump and restore', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all(db.modelNames().map((name) => db.model(name).deleteMany({})));
    const admin = await db.model('User').create({ name: 'Owner', email: 'o@shop.example', password: 'x', isSuper: true });
    await db.model('Category').create({ name: { en: 'Tea', ar: 'شاي' }, slug: 'tea' });
    await db.model('RefreshToken').create({ token: 'live-session', userId: admin._id, expiryDate: new Date() });
  });

  it('dumps real types and leaves credentials out', async () => {
    const parsed = EJSON.parse(await dumpStore(db, HOST), { relaxed: false });
    expect(parsed.host).toBe(HOST);
    expect(parsed.collections.refreshtokens).toBeUndefined();
    const [category] = parsed.collections.categories;
    expect(category._id).toBeInstanceOf(Types.ObjectId);
    expect(category.createdAt).toBeInstanceOf(Date);
  });

  it("refuses another store's backup and a foreign format", async () => {
    const dump = await dumpStore(db, HOST);
    await expect(restoreStore(db, 'other.example', dump)).rejects.toBeInstanceOf(RestoreError);
    await expect(restoreStore(db, HOST, JSON.stringify({ categories: [] }))).rejects.toBeInstanceOf(RestoreError);
  });

  it('only checks the file on a dry run', async () => {
    const dump = await dumpStore(db, HOST);
    await db.model('Category').deleteMany({});
    const report = await restoreStore(db, HOST, dump);
    expect(report).toMatchObject({ dryRun: true, restored: false, errors: [] });
    expect(await db.model('Category').countDocuments()).toBe(0);
  });

  it('rolls a live store back, orders included, and clears sessions', async () => {
    const before = await db.model('Category').findOne().lean();
    const dump = await dumpStore(db, HOST);

    // Things that happen after the backup.
    await db.model('Order').collection.insertOne({ orderNumber: 1001 });
    await db.model('Category').updateOne({}, { slug: 'changed' });

    const report = await restoreStore(db, HOST, dump, { dryRun: false });
    expect(report.restored).toBe(true);
    expect(await db.model('Category').findOne().lean()).toEqual(before);
    expect(await db.model('Order').countDocuments()).toBe(0);
    expect(await db.model('RefreshToken').countDocuments()).toBe(0);
  });

  it('refuses a file with an invalid document, and writes nothing', async () => {
    const parsed = EJSON.parse(await dumpStore(db, HOST), { relaxed: false });
    parsed.collections.categories.push({ _id: new Types.ObjectId() }); // no name, no slug
    const dump = EJSON.stringify(parsed, { relaxed: false });
    await db.model('Category').deleteMany({});

    await expect(restoreStore(db, HOST, dump, { dryRun: false })).rejects.toBeInstanceOf(RestoreError);
    expect(await db.model('Category').countDocuments()).toBe(0);
  });
});

describe('backup ids', () => {
  it('round-trips and rejects anything else', () => {
    const at = new Date('2026-11-11T22:00:05.123Z');
    const id = backupId('daily', at);
    expect(id).toBe('2026-11-11T22-00-05Z_daily.json.gz');
    expect(parseBackupId(id)).toEqual({ kind: 'daily', createdAt: new Date('2026-11-11T22:00:05Z') });
    expect(parseBackupId('../other.example/backup/x.json.gz')).toBeNull();
    expect(parseBackupId('2026-11-11T22-00-05Z_daily.json.gz/../x')).toBeNull();
  });
});

describe('msUntilMidnight', () => {
  it('counts to the next midnight in the given zone', () => {
    // 21:00 UTC is 23:00 in Cairo during winter (UTC+2): an hour to go, plus the 5 s margin.
    expect(msUntilMidnight('Africa/Cairo', new Date('2026-01-15T21:00:00Z'))).toBe(3600_000 + 5_000);
    expect(msUntilMidnight('UTC', new Date('2026-01-15T00:00:00Z'))).toBe(24 * 3600_000 + 5_000);
  });
});
