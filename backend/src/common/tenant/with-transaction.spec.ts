import { ServiceUnavailableException } from '@nestjs/common';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { startReplSet, tenantConnection } from '../../../test/helpers/replset';
import { supportsTransactions, withTransaction } from './with-transaction';

jest.setTimeout(120_000);

describe('withTransaction', () => {
  let replSet: MongoMemoryReplSet;
  let storeA: Connection;
  let storeB: Connection;

  beforeAll(async () => {
    replSet = await startReplSet();
    storeA = await tenantConnection(replSet, 'store-a');
    storeB = await tenantConnection(replSet, 'store-b');
  });

  afterAll(async () => {
    await Promise.all([storeA?.close(), storeB?.close()]);
    await replSet?.stop();
  });

  beforeEach(async () => {
    await storeA.model('Counter').deleteMany({});
    await storeB.model('Counter').deleteMany({});
  });

  it('commits every write together', async () => {
    const Counter = storeA.model('Counter');
    await withTransaction(storeA, async (session) => {
      await Counter.create([{ name: 'a', seq: 1 }], { session });
      await Counter.create([{ name: 'b', seq: 2 }], { session });
    });
    expect(await Counter.countDocuments()).toBe(2);
  });

  it('keeps nothing when the work throws part-way', async () => {
    const Counter = storeA.model('Counter');
    await expect(
      withTransaction(storeA, async (session) => {
        await Counter.create([{ name: 'a', seq: 1 }], { session });
        throw new Error('stock ran out');
      }),
    ).rejects.toThrow('stock ran out');
    expect(await Counter.countDocuments()).toBe(0);
  });

  it("refuses a session from another store's connection", async () => {
    await expect(
      withTransaction(storeA, async (session) => {
        await storeB.model('Counter').create([{ name: 'leak', seq: 1 }], { session });
      }),
    ).rejects.toThrow(/same MongoClient/i);
    expect(await storeB.model('Counter').countDocuments()).toBe(0);
  });

  it('refuses a database that is not a replica set', async () => {
    const standalone = await MongoMemoryServer.create();
    const connection = await mongoose.createConnection(standalone.getUri('solo')).asPromise();
    try {
      expect(await supportsTransactions(connection)).toBe(false);
      await expect(withTransaction(connection, async () => 'never')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    } finally {
      await connection.close();
      await standalone.stop();
    }
  });
});
