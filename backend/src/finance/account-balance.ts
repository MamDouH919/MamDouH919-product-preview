import { AccountType, BalanceSide, normalSideOf } from './accounts';

/** Why a balance on the unusual side needs checking; the dashboard translates it as `trialUnusualReason.<key>`. */
export type UnusualBalanceReason = 'asset_credit' | 'expense_credit' | 'contra_revenue_credit' | 'liability_debit' | 'revenue_debit' | 'equity_debit';

const UNUSUAL_REASON: Record<AccountType, UnusualBalanceReason> = {
  [AccountType.ASSET]: 'asset_credit',
  [AccountType.EXPENSE]: 'expense_credit',
  [AccountType.COST_OF_SALES]: 'expense_credit',
  [AccountType.CONTRA_REVENUE]: 'contra_revenue_credit',
  [AccountType.LIABILITY]: 'liability_debit',
  [AccountType.REVENUE]: 'revenue_debit',
  [AccountType.EQUITY]: 'equity_debit',
};

export interface AccountBalance {
  /** Always zero or more; `side` says where it falls. */
  balanceMinor: number;
  /** The side the balance falls on: debit when debits are the larger total or the two are equal. */
  side: BalanceSide;
  normalSide: BalanceSide;
  /** There is a balance, and it is not on the account type's normal side. */
  isUnusual: boolean;
  unusualReason: UnusualBalanceReason | null;
}

/**
 * An account's balance worked out from its debit and credit totals. The side
 * comes from the totals alone and the account type only says whether that side
 * is the expected one, so never derive a side from a balance already signed
 * for the account's nature, as `JournalService.balances` is.
 */
export function accountBalance(type: AccountType, debitMinor: number, creditMinor: number): AccountBalance {
  const diff = debitMinor - creditMinor;
  const side: BalanceSide = diff >= 0 ? 'debit' : 'credit';
  const normalSide = normalSideOf(type);
  const isUnusual = diff !== 0 && side !== normalSide;
  return { balanceMinor: Math.abs(diff), side, normalSide, isUnusual, unusualReason: isUnusual ? UNUSUAL_REASON[type] : null };
}
