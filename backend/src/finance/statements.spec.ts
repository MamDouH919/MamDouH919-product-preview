import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { Custody } from './schemas/payment.schema';
import { ACCOUNT } from './accounts';
import { MoneyAccountType } from '../money-accounts/schemas/money-account.schema';
import { RefundMethod, RefundReason } from '../refunds/schemas/refund.schema';
import { dayKey } from '../common/helpers/time-zone';

jest.setTimeout(180_000);

/**
 * Step 6: money accounts, the statements and closing periods. Each statement
 * is checked against figures worked out independently from the events.
 */
describe('Statements, money accounts and periods', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let store: Store;
  let owner: string;

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
    store = buildStore(db);
    owner = String((await db.model('User').create({ name: 'Owner', email: 'o@x', password: 'x', isSuper: true }))._id);
  });

  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };
  const today = () => dayKey(new Date(), 'Africa/Cairo');
  const yesterday = () => dayKey(new Date(Date.now() - 86_400_000), 'Africa/Cairo');

  /** E1: 2 × A at 150.00 (cost 90.00), 10% off, delivery 45.00 — 315.00, delivered. */
  const e1 = async (collect?: { moneyAccountId?: string }) => {
    store.delivery.price = 45;
    const a = await store.product(150, 10, 90);
    await store.coupon({ code: `TEN${new Types.ObjectId()}`.slice(0, 20).toUpperCase(), value: 10 });
    const code = (await db.model('Coupon').findOne().lean<any>()).code;
    const order = await store.place(await store.customer(), [{ productId: a, quantity: 2 }], code);
    await store.advance(String(order._id));
    if (collect) await store.payments.recordCollection(String(order._id), { amount: '315', custody: Custody.STORE, ...collect });
    return { orderId: String(order._id), productId: a };
  };

  describe('money accounts', () => {
    it('keep their own balances; transfers move money between them, never more than is there', async () => {
      const accounts = await store.moneyAccounts.list();
      expect(accounts.map((a: any) => [a.name, a.isDefault])).toEqual([['Cash', true]]);
      const cash = String(accounts[0]._id);
      const bank = String((await store.moneyAccounts.create({ name: 'Bank Misr', type: MoneyAccountType.BANK }))._id);

      await e1({ moneyAccountId: bank }); // collected straight into the bank
      await store.expenses.create({ account: ACCOUNT.RENT, amount: '100', description: 'Rent', moneyAccountId: bank });
      await expect(store.moneyAccounts.transfer({ fromId: cash, toId: bank, amount: '1' })).rejects.toThrow('holds only 0.00');
      await store.moneyAccounts.transfer({ fromId: bank, toId: cash, amount: '200' });

      const balances = Object.fromEntries((await store.moneyAccounts.list()).map((a: any) => [a.name, a.balanceMinor]));
      expect(balances).toEqual({ Cash: 20000, 'Bank Misr': 31500 - 10000 - 20000 });
      expect((await store.journal.balances())[ACCOUNT.CASH]).toBe(21500);

      await expect(store.moneyAccounts.update(bank, { isActive: false })).rejects.toBeInstanceOf(ConflictException);
      await store.moneyAccounts.update(bank, { isDefault: true });
      expect((await store.moneyAccounts.list()).filter((a: any) => a.isDefault).map((a: any) => a.name)).toEqual(['Bank Misr']);
      await reconciled();
    });
  });

  describe('statements', () => {
    it('profit and loss, trial balance and cash flow agree with the events', async () => {
      await e1({});
      await store.expenses.create({ account: ACCOUNT.RENT, amount: '3000', description: 'Rent' });

      const pl = await store.statements.profitAndLoss(today(), today());
      const amount = (lines: any[], code: string) => lines.find((l) => l.code === code)?.amountMinor;
      expect(amount(pl.revenue, ACCOUNT.PRODUCT_SALES)).toBe(30000);
      expect(amount(pl.revenue, ACCOUNT.SALES_DISCOUNTS)).toBe(3000);
      expect(amount(pl.revenue, ACCOUNT.DELIVERY_INCOME)).toBe(4500);
      expect(amount(pl.costOfSales, ACCOUNT.COGS)).toBe(18000);
      expect(amount(pl.expenses, ACCOUNT.RENT)).toBe(300000);
      expect(pl.totals).toMatchObject({ netRevenueMinor: 31500, grossProfitMinor: 13500, netProfitMinor: 13500 - 300000 });
      expect(pl.previousTotals).toMatchObject({ netRevenueMinor: 0 });

      const tb = await store.statements.trialBalance(today());
      expect(tb.balanced).toBe(true);
      expect(tb.totalDebitMinor).toBe(tb.totalCreditMinor);
      expect(tb.accounts.find((a) => a.code === ACCOUNT.CASH)?.balanceMinor).toBe(31500 - 300000);

      const flow = await store.statements.cashFlow(today(), today());
      expect(Object.fromEntries(flow.lines.map((l) => [l.key, l.amountMinor]))).toEqual({ payment: 31500, [`expense:${ACCOUNT.RENT}`]: -300000 });
      expect(flow).toMatchObject({ inflowMinor: 31500, outflowMinor: 300000, netMinor: -268500 });
      expect(flow.closingMinor - flow.openingMinor).toBe(flow.netMinor);
      await reconciled();
    });

    it('what customers owe and what suppliers are owed, by age', async () => {
      const { orderId } = await e1(); // delivered, nothing collected
      await db.model('Order').updateOne({ _id: orderId }, { deliveredAt: new Date(Date.now() - 40 * 86_400_000) });
      const receivables = await store.statements.receivables();
      expect(receivables.rows).toEqual([expect.objectContaining({ owedMinor: 31500, days: 40, bucket: '31_60' })]);
      expect(receivables.buckets).toMatchObject({ '31_60': 31500, '0_7': 0 });

      const supplierId = String((await store.purchasing.createSupplier({ name: 'Nile Traders' }))._id);
      const item = await store.product(10, 0);
      const draft = await store.purchasing.createPurchase({ supplierId, date: new Date().toISOString(), lines: [{ productId: item, quantity: 5, unitCost: '4' }] });
      await store.purchasing.postPurchase(String(draft._id));
      const payables = await store.statements.payables();
      expect(payables).toMatchObject({ totalMinor: 2000, buckets: { '0_7': 2000 } });
      expect(payables.rows[0]).toMatchObject({ supplier: 'Nile Traders', owedMinor: 2000 });
    });

    it('sales by product: units, net sales after discount, cost, margin and refunds', async () => {
      const { orderId, productId } = await e1({});
      const refund = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1, restock: true }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        undefined,
      );
      await store.refunds.execute(String(refund._id), undefined, 'shop.test');

      const { rows } = await store.statements.salesByProduct(today(), today());
      expect(rows).toEqual([
        expect.objectContaining({ productId: new Types.ObjectId(productId), units: 2, netSalesMinor: 27000, costMinor: 18000, marginMinor: 9000, refundedUnits: 1, refundedMinor: 13500 }),
      ]);
    });
  });

  describe('closing periods', () => {
    it("only the store's super admin closes days that are over, and only when the books reconcile", async () => {
      const staff = String((await db.model('User').create({ name: 'S', email: 's@x', password: 'x' }))._id);
      await expect(store.periods.lock(yesterday(), staff)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(store.periods.lock(today(), owner)).rejects.toBeInstanceOf(BadRequestException);

      // A broken entry blocks closing.
      await db.model('JournalEntry').collection.insertOne({
        entryNumber: 999,
        date: new Date(),
        source: { type: 'test', id: new Types.ObjectId(), event: 'x' },
        lines: [{ account: ACCOUNT.CASH, debitMinor: 100, creditMinor: 0, moneyAccount: new Types.ObjectId() }],
      });
      await expect(store.periods.lock(yesterday(), owner)).rejects.toBeInstanceOf(ConflictException);
      await db.model('JournalEntry').deleteMany({ entryNumber: 999 });

      const locked = await store.periods.lock(yesterday(), owner);
      expect(locked.lockedThroughDay).toBe(yesterday());
      await expect(store.periods.lock(yesterday(), owner)).rejects.toBeInstanceOf(ConflictException);

      // Nothing can now be dated yesterday; today is still open.
      await expect(
        store.expenses.create({ account: ACCOUNT.RENT, amount: '10', description: 'late', date: new Date(Date.now() - 86_400_000).toISOString() }),
      ).rejects.toThrow(`closed through ${yesterday()}`);
      await expect(store.expenses.create({ account: ACCOUNT.RENT, amount: '10', description: 'today' })).resolves.toBeDefined();

      await expect(store.periods.reopen(undefined, '', owner)).rejects.toBeInstanceOf(BadRequestException);
      const reopened = await store.periods.reopen(undefined, 'Supplier invoice found late', owner);
      expect(reopened.lockedThroughDay).toBeNull();
      expect(reopened.history.map((h: any) => h.to)).toEqual([yesterday(), { day: null, reason: 'Supplier invoice found late' }]);
    });
  });
});
