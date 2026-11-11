import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { Custody } from './schemas/payment.schema';
import { ACCOUNT, AccountType, CashFlowActivity } from './accounts';
import { MoneyAccountType } from '../money-accounts/schemas/money-account.schema';
import { dayKey } from '../common/helpers/time-zone';

jest.setTimeout(180_000);

/**
 * The accounting cycle by hand: the chart of accounts, manual journal
 * entries, each account's statement, the trial balance and the three
 * statements — alongside the entries business events post, with the
 * reconciliation still passing.
 */
describe('Chart of accounts, manual journal and statements', () => {
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

  const today = () => dayKey(new Date(), 'Africa/Cairo');
  const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86_400_000), 'Africa/Cairo');
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };
  const post = (lines: { account: string; debit?: string; credit?: string; moneyAccountId?: string }[], date = today(), memo = 'Manual') =>
    store.ledger.createManual({ date, memo, lines }, owner);

  /** 2 × 150.00 (cost 90.00), delivery 45.00 — 345.00, delivered and collected into cash. */
  const sale = async () => {
    store.delivery.price = 45;
    const product = await store.product(150, 10, 90);
    const order = await store.place(await store.customer(), [{ productId: product, quantity: 2 }]);
    await store.advance(String(order._id));
    await store.payments.recordCollection(String(order._id), { amount: '345', custody: Custody.STORE });
  };

  describe('chart of accounts', () => {
    it('lists the built-in accounts by category and adds the store’s own, numbered by type', async () => {
      const chart = await store.chart.list();
      const cash = chart.find((a) => a.code === ACCOUNT.CASH)!;
      expect(cash).toMatchObject({ category: 'assets', normalSide: 'debit', isSystem: true, allowsManual: true });
      expect(chart.find((a) => a.code === ACCOUNT.RECEIVABLES)).toMatchObject({ category: 'assets', allowsManual: false });
      expect(chart.find((a) => a.code === ACCOUNT.PRODUCT_SALES)).toMatchObject({ category: 'revenue', normalSide: 'credit' });
      expect(chart.find((a) => a.code === ACCOUNT.COGS)).toMatchObject({ category: 'expenses' });

      await expect(store.chart.create({ code: '6100', name: { en: 'x', ar: 'x' }, type: AccountType.EXPENSE })).rejects.toBeInstanceOf(ConflictException);
      await expect(store.chart.create({ code: '1500', name: { en: 'Loan', ar: 'قرض' }, type: AccountType.LIABILITY })).rejects.toBeInstanceOf(BadRequestException);

      expect(await store.chart.nextCode(AccountType.LIABILITY)).toBe('2010');
      const loan = await store.chart.create({ code: '2500', name: { en: 'Bank loan', ar: 'قرض بنكي' }, type: AccountType.LIABILITY }, owner);
      expect(loan).toMatchObject({ code: '2500', category: 'liabilities', normalSide: 'credit', cashFlowActivity: 'financing', isSystem: false, isActive: true });
      await expect(store.chart.create({ code: '2500', name: { en: 'Again', ar: 'مرة' }, type: AccountType.LIABILITY })).rejects.toBeInstanceOf(ConflictException);
      await expect(store.chart.update(ACCOUNT.CASH, { name: { en: 'Money', ar: 'فلوس' } })).rejects.toBeInstanceOf(ForbiddenException);

      const codes = (await store.chart.list()).map((a) => a.code);
      expect(codes.indexOf('2500')).toBeGreaterThan(codes.indexOf(ACCOUNT.TAX_PAYABLE));
      expect(codes.indexOf('2500')).toBeLessThan(codes.indexOf(ACCOUNT.EQUITY));
    });

    it('deactivates an added account only once its balance is cleared', async () => {
      await store.chart.create({ code: '1600', name: { en: 'Equipment', ar: 'معدات' }, type: AccountType.ASSET });
      await post([{ account: '1600', debit: '500' }, { account: ACCOUNT.CASH, credit: '500' }]);
      await expect(store.chart.update('1600', { isActive: false })).rejects.toBeInstanceOf(ConflictException);
      await post([{ account: ACCOUNT.CASH, debit: '500' }, { account: '1600', credit: '500' }]);
      expect(await store.chart.update('1600', { isActive: false })).toMatchObject({ isActive: false, allowsManual: false });
      await expect(post([{ account: '1600', debit: '1' }, { account: ACCOUNT.CASH, credit: '1' }])).rejects.toThrow('inactive');
    });
  });

  describe('manual journal entries', () => {
    it('must balance, name accounts in the chart, keep off sub-ledger accounts and stay out of the future', async () => {
      await expect(post([{ account: ACCOUNT.RENT, debit: '100' }, { account: ACCOUNT.CASH, credit: '90' }])).rejects.toThrow('does not balance');
      await expect(post([{ account: ACCOUNT.RENT, debit: '100', credit: '100' }, { account: ACCOUNT.CASH, credit: '0' }])).rejects.toBeInstanceOf(BadRequestException);
      await expect(post([{ account: '9999', debit: '100' }, { account: ACCOUNT.CASH, credit: '100' }])).rejects.toThrow('no account 9999');
      await expect(post([{ account: ACCOUNT.RECEIVABLES, debit: '100' }, { account: ACCOUNT.CASH, credit: '100' }])).rejects.toThrow("can't take a manual entry");
      await expect(post([{ account: ACCOUNT.RENT, debit: '100' }, { account: ACCOUNT.CASH, credit: '100' }], daysAgo(-2))).rejects.toThrow('future');
      expect(await db.model('JournalEntry').countDocuments()).toBe(0);
    });

    it('post to the journal, show in each account’s statement with a running balance, and reverse by mirror image', async () => {
      const bank = String((await store.moneyAccounts.create({ name: 'Bank Misr', type: MoneyAccountType.BANK }))._id);
      await store.chart.create({ code: '2500', name: { en: 'Bank loan', ar: 'قرض بنكي' }, type: AccountType.LIABILITY });

      // Owner puts in 10,000; the store borrows 5,000 into the bank; pays 1,200 rent from it.
      await post([{ account: ACCOUNT.CASH, debit: '10000' }, { account: ACCOUNT.EQUITY, credit: '10000' }], daysAgo(3), 'Capital');
      await post([{ account: ACCOUNT.CASH, debit: '5000', moneyAccountId: bank }, { account: '2500', credit: '5000' }], daysAgo(2), 'Loan');
      const rent = await post([{ account: ACCOUNT.RENT, debit: '1200' }, { account: ACCOUNT.CASH, credit: '1200', moneyAccountId: bank }], daysAgo(1), 'Rent');

      const journal = await store.ledger.list({});
      expect(journal.total).toBe(3);
      expect(journal.rows.map((e) => e.memo?.en)).toEqual(['Rent', 'Loan', 'Capital']);
      expect(journal.rows[0]).toMatchObject({ isManual: true, totalMinor: 120_000, createdBy: { name: 'Owner' } });
      expect(journal.rows[0].lines[0]).toMatchObject({ account: ACCOUNT.RENT, name: { en: 'Rent' }, debitMinor: 120_000 });
      expect((await store.ledger.list({ account: '2500' })).total).toBe(1);

      const cash = await store.ledger.accountStatement(ACCOUNT.CASH, { from: daysAgo(2) });
      expect(cash.openingMinor).toBe(1_000_000);
      expect(cash.rows.map((r) => [r.debitMinor, r.creditMinor, r.balanceMinor])).toEqual([
        [500_000, 0, 1_500_000],
        [0, 120_000, 1_380_000],
      ]);
      expect(cash.rows[1]).toMatchObject({ moneyAccount: 'Bank Misr', counterparts: [{ code: ACCOUNT.RENT }] });
      expect(cash.closingMinor).toBe(1_380_000);
      const bankOnly = await store.ledger.accountStatement(ACCOUNT.CASH, { moneyAccount: bank });
      expect(bankOnly.closingMinor).toBe(380_000);

      // A credit-normal account's balance grows with credits.
      const loan = await store.ledger.accountStatement('2500', {});
      expect(loan).toMatchObject({ openingMinor: 0, creditMinor: 500_000, closingMinor: 500_000 });

      await expect(store.ledger.reverseManual(String(rent!._id), { reason: 'Wrong month' }, owner)).resolves.toBeTruthy();
      await expect(store.ledger.reverseManual(String(rent!._id), { reason: 'Again' }, owner)).rejects.toBeInstanceOf(ConflictException);
      expect(await store.ledger.get(String(rent!._id))).toMatchObject({ isReversed: true, reversedBy: { entryNumber: 4 } });
      expect((await store.journal.balances())[ACCOUNT.RENT]).toBe(0);

      // Entries from business events are undone through their documents, not here.
      await sale();
      const order = await db.model('JournalEntry').findOne({ 'source.type': 'order' }).lean<any>();
      await expect(store.ledger.reverseManual(String(order._id), { reason: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      await reconciled();
    });

    it('are refused inside closed books', async () => {
      await store.periods.lock(daysAgo(1), owner);
      await expect(post([{ account: ACCOUNT.RENT, debit: '1' }, { account: ACCOUNT.CASH, credit: '1' }], daysAgo(2))).rejects.toBeInstanceOf(ConflictException);
      await expect(post([{ account: ACCOUNT.RENT, debit: '1' }, { account: ACCOUNT.CASH, credit: '1' }])).resolves.toBeTruthy();
    });
  });

  describe('trial balance and statements', () => {
    it('carry manual and event entries together, and the balance sheet balances', async () => {
      await store.chart.create({ code: '2500', name: { en: 'Bank loan', ar: 'قرض بنكي' }, type: AccountType.LIABILITY });
      await store.chart.create({ code: '1600', name: { en: 'Equipment', ar: 'معدات' }, type: AccountType.ASSET, cashFlowActivity: CashFlowActivity.INVESTING });
      await store.chart.create({ code: '4500', name: { en: 'Consulting income', ar: 'إيرادات استشارات' }, type: AccountType.REVENUE });

      await post([{ account: ACCOUNT.CASH, debit: '10000' }, { account: ACCOUNT.EQUITY, credit: '10000' }]);
      await post([{ account: ACCOUNT.CASH, debit: '5000' }, { account: '2500', credit: '5000' }]);
      // Equipment for 3,000: 2,000 cash and 1,000 more on the loan.
      await post([{ account: '1600', debit: '3000' }, { account: ACCOUNT.CASH, credit: '2000' }, { account: '2500', credit: '1000' }]);
      await post([{ account: ACCOUNT.CASH, debit: '700' }, { account: '4500', credit: '700' }]);
      await post([{ account: ACCOUNT.SALARIES, debit: '400' }, { account: ACCOUNT.CASH, credit: '400' }]);
      await sale(); // 300 sales + 45 delivery − 180 cost, 345 collected

      const tb = await store.statements.trialBalance(undefined, today());
      expect(tb.balanced).toBe(true);
      expect(tb.accounts.find((a) => a.code === '2500')).toMatchObject({ creditMinor: 600_000, balanceMinor: 600_000, side: 'credit', category: 'liabilities' });

      const pl = await store.statements.profitAndLoss(today(), today());
      expect(pl.revenue.find((l) => l.code === '4500')?.amountMinor).toBe(70_000);
      expect(pl.totals).toMatchObject({ otherRevenueMinor: 70_000, netRevenueMinor: 30_000 + 4_500 + 70_000, costOfSalesMinor: 18_000, operatingExpensesMinor: 40_000 });
      const profit = 30_000 + 4_500 + 70_000 - 18_000 - 40_000;
      expect(pl.totals.netProfitMinor).toBe(profit);

      const bs = await store.statements.balanceSheet(today());
      const cash = 1_000_000 + 500_000 - 200_000 + 70_000 - 40_000 + 34_500;
      expect(bs.assets.lines.find((l) => l.code === ACCOUNT.CASH)?.amountMinor).toBe(cash);
      expect(bs.assets.lines.find((l) => l.code === '1600')?.amountMinor).toBe(300_000);
      expect(bs.liabilities.totalMinor).toBe(600_000);
      expect(bs.equity.currentEarningsMinor).toBe(profit);
      // Capital, plus the opening stock the product came with (10 × 90.00 against equity), plus profit.
      expect(bs.equity.totalMinor).toBe(1_000_000 + 90_000 + profit);
      expect(bs.balanced).toBe(true);
      expect(bs.totalAssetsMinor).toBe(bs.totalLiabilitiesAndEquityMinor);

      const flow = await store.statements.cashFlow(today(), today());
      const net = Object.fromEntries(flow.sections.map((s) => [s.activity, s.netMinor]));
      // Only the cash part of the equipment is investing; the loan-financed part moved no cash.
      expect(net).toEqual({ operating: 70_000 - 40_000 + 34_500, investing: -200_000, financing: 1_000_000 + 500_000 });
      expect(flow.netMinor).toBe(net.operating + net.investing + net.financing);
      expect(flow.closingMinor - flow.openingMinor).toBe(flow.netMinor);
      await reconciled();
    });

    it('keep the reconciliation passing when manual entries post to expense accounts', async () => {
      await store.expenses.create({ account: ACCOUNT.RENT, amount: '1000', description: 'Rent' });
      await post([{ account: ACCOUNT.RENT, debit: '250' }, { account: ACCOUNT.TAX_PAYABLE, credit: '250' }]);
      expect((await store.journal.balances())[ACCOUNT.RENT]).toBe(125_000);
      await reconciled();
    });
  });

  it('uses no account the chart does not know, even from code', async () => {
    await expect(
      db.transaction((session) =>
        store.journal.post({ date: new Date(), source: { type: 'test', id: new Types.ObjectId(), event: 'x' }, lines: [{ account: '7777', debitMinor: 1 }, { account: ACCOUNT.CASH, creditMinor: 1 }] }, session),
      ),
    ).rejects.toThrow('unknown account 7777');
  });
});
