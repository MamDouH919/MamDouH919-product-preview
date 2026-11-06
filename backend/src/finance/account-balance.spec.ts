import type { Response } from 'express';
import { accountBalance } from './account-balance';
import { AccountType } from './accounts';
import { StatementsController } from './statements.controller';

const { ASSET, LIABILITY, EQUITY, REVENUE, CONTRA_REVENUE, COST_OF_SALES, EXPENSE } = AccountType;

describe('accountBalance', () => {
  describe('a balance on the normal side is not unusual', () => {
    it.each([
      [ASSET, 500, 200, 'debit'],
      [EXPENSE, 500, 200, 'debit'],
      [COST_OF_SALES, 500, 200, 'debit'],
      [CONTRA_REVENUE, 500, 200, 'debit'],
      [LIABILITY, 200, 500, 'credit'],
      [REVENUE, 200, 500, 'credit'],
      [EQUITY, 200, 500, 'credit'],
    ])('%s', (type, debit, credit, side) => {
      expect(accountBalance(type, debit, credit)).toEqual({ balanceMinor: 300, side, normalSide: side, isUnusual: false, unusualReason: null });
    });
  });

  describe('a balance on the other side is unusual, with a reason for its type', () => {
    it.each([
      [ASSET, 200, 500, 'credit', 'debit', 'asset_credit'],
      [EXPENSE, 200, 500, 'credit', 'debit', 'expense_credit'],
      [COST_OF_SALES, 200, 500, 'credit', 'debit', 'expense_credit'],
      [CONTRA_REVENUE, 200, 500, 'credit', 'debit', 'contra_revenue_credit'],
      [LIABILITY, 500, 200, 'debit', 'credit', 'liability_debit'],
      [REVENUE, 500, 200, 'debit', 'credit', 'revenue_debit'],
      [EQUITY, 500, 200, 'debit', 'credit', 'equity_debit'],
    ])('%s', (type, debit, credit, side, normalSide, unusualReason) => {
      expect(accountBalance(type, debit, credit)).toEqual({ balanceMinor: 300, side, normalSide, isUnusual: true, unusualReason });
    });
  });

  describe('a zero balance is never unusual, whatever the type', () => {
    it.each([ASSET, EXPENSE, COST_OF_SALES, CONTRA_REVENUE, LIABILITY, REVENUE, EQUITY])('%s', (type) => {
      for (const total of [0, 700]) {
        expect(accountBalance(type, total, total)).toMatchObject({ balanceMinor: 0, isUnusual: false, unusualReason: null });
      }
    });
  });

  it('the reported trial balance: every side is right and the warnings list is empty', () => {
    const report: [string, AccountType, number, number, 'debit' | 'credit', number][] = [
      ['1000', ASSET, 200_250_000, 2_420_000, 'debit', 197_830_000],
      ['1200', ASSET, 250_000, 250_000, 'debit', 0],
      ['1300', ASSET, 2_420_000, 161_333, 'debit', 2_258_667],
      ['1310', ASSET, 161_333, 161_333, 'debit', 0],
      ['2000', LIABILITY, 2_420_000, 2_420_000, 'debit', 0],
      ['3000', EQUITY, 0, 200_000_000, 'credit', 200_000_000],
      ['4000', REVENUE, 0, 240_000, 'credit', 240_000],
      ['4100', REVENUE, 0, 10_000, 'credit', 10_000],
      ['5000', COST_OF_SALES, 161_333, 0, 'debit', 161_333],
    ];
    const results = report.map(([code, type, debit, credit]) => ({ code, ...accountBalance(type, debit, credit) }));

    expect(results.map((r) => [r.code, r.side, r.balanceMinor])).toEqual(report.map(([code, , , , side, balance]) => [code, side, balance]));
    expect(results.filter((r) => r.isUnusual)).toEqual([]);
    expect(report.reduce((t, r) => t + r[2], 0)).toBe(report.reduce((t, r) => t + r[3], 0));
  });
});

describe('profit and loss CSV', () => {
  it('shows discounts and returns as deductions, so the revenue lines add up to net revenue', async () => {
    const line = (code: string, type: AccountType, amountMinor: number, previousMinor?: number) => ({ code, name: { en: code, ar: code }, type, amountMinor, previousMinor });
    const pl = {
      revenue: [line('4000', REVENUE, 30000, 10000), line('4010', CONTRA_REVENUE, 3000, 0), line('4020', CONTRA_REVENUE, 500), line('4100', REVENUE, 4500, 0)],
      costOfSales: [line('5000', COST_OF_SALES, 18000, 6000)],
      expenses: [line('6100', EXPENSE, 2000)],
    };
    const send = jest.fn();
    const res = { setHeader: jest.fn(), send } as unknown as Response;
    await new StatementsController({ profitAndLoss: async () => pl } as never, {} as never).profitAndLoss({ format: 'csv' }, res);

    expect((send.mock.calls[0][0] as string).replace(/^﻿/, '').trim().split('\r\n')).toEqual([
      'account,name,amount,previous',
      '4000,4000,300.00,100.00',
      '4010,4010,-30.00,0.00',
      '4020,4020,-5.00,',
      '4100,4100,45.00,0.00',
      '5000,5000,180.00,60.00',
      '6100,6100,20.00,',
    ]);
  });
});

describe('trial balance CSV', () => {
  const account = (code: string, name: string, type: AccountType, debitMinor: number, creditMinor: number) => ({
    code,
    name: { en: name, ar: name },
    type,
    debitMinor,
    creditMinor,
    ...accountBalance(type, debitMinor, creditMinor),
  });

  const csv = async (lang: 'en' | 'ar') => {
    const accounts = [
      account('1000', 'Cash', ASSET, 200_000_000, 0),
      account('1310', 'Goods', ASSET, 500, 500),
      account('2000', 'Payables', LIABILITY, 700, 200),
      account('3000', 'Equity', EQUITY, 0, 200_000_000),
      account('4000', 'Sales', REVENUE, 0, 240_000),
    ];
    const totalDebitMinor = accounts.reduce((t, a) => t + a.debitMinor, 0);
    const totalCreditMinor = accounts.reduce((t, a) => t + a.creditMinor, 0);
    const statements = { trialBalance: async () => ({ accounts, totalDebitMinor, totalCreditMinor }) };
    const send = jest.fn();
    const res = { setHeader: jest.fn(), send } as unknown as Response;
    await new StatementsController(statements as never, {} as never).trialBalance({ format: 'csv', lang }, res);
    return (send.mock.calls[0][0] as string).replace(/^﻿/, '').trim().split('\r\n');
  };

  it('writes each balance unsigned with the side it really falls on', async () => {
    expect(await csv('en')).toEqual([
      'account,name,debit,credit,balance,side',
      '1000,Cash,2000000.00,0.00,2000000.00,Debit',
      '1310,Goods,5.00,5.00,0.00,',
      '2000,Payables,7.00,2.00,5.00,Debit',
      '3000,Equity,0.00,2000000.00,2000000.00,Credit',
      '4000,Sales,0.00,2400.00,2400.00,Credit',
      ',Total,2000012.00,2002407.00,,',
    ]);
  });

  it('names the side in Arabic for an Arabic file', async () => {
    const rows = await csv('ar');
    expect(rows.find((r) => r.startsWith('1000,'))?.endsWith(',مدين')).toBe(true);
    expect(rows.find((r) => r.startsWith('3000,'))?.endsWith(',دائن')).toBe(true);
  });
});
