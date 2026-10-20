/**
 * The chart of accounts every store's books use. Codes are fixed: postings,
 * reports and reconciliation all name accounts by code, so renumbering one
 * would split its history. Accounts a store adds itself (more cash boxes,
 * expense categories) come later and must not reuse these codes.
 */

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  /** Reduces revenue: discounts, returns. Debit-normal. */
  CONTRA_REVENUE = 'contra_revenue',
  COST_OF_SALES = 'cost_of_sales',
  EXPENSE = 'expense',
}

export const ACCOUNT = {
  CASH: '1000',
  COURIER_CASH: '1100',
  RECEIVABLES: '1200',
  INVENTORY: '1300',
  GOODS_AWAITING_DELIVERY: '1310',
  PAYABLES: '2000',
  REFUNDS_PAYABLE: '2100',
  CUSTOMER_DEPOSITS: '2200',
  TAX_PAYABLE: '2300',
  EQUITY: '3000',
  PRODUCT_SALES: '4000',
  SALES_DISCOUNTS: '4010',
  SALES_RETURNS: '4020',
  DELIVERY_INCOME: '4100',
  DELIVERY_REFUNDS: '4110',
  COGS: '5000',
  INVENTORY_LOSSES: '5010',
  DELIVERY_COSTS: '6000',
  RENT: '6100',
  SALARIES: '6200',
  MARKETING: '6300',
  PACKAGING: '6400',
  FEES: '6500',
  UTILITIES: '6600',
  OTHER_EXPENSES: '6700',
  UNCOLLECTIBLE: '6800',
  CASH_OVER_SHORT: '6900',
} as const;

export type AccountCode = (typeof ACCOUNT)[keyof typeof ACCOUNT];

export interface AccountInfo {
  code: AccountCode;
  name: { en: string; ar: string };
  type: AccountType;
}

export const CHART: AccountInfo[] = [
  { code: ACCOUNT.CASH, name: { en: 'Cash on hand', ar: 'النقدية بالصندوق' }, type: AccountType.ASSET },
  { code: ACCOUNT.COURIER_CASH, name: { en: 'COD cash held by couriers', ar: 'نقدية التحصيل لدى المندوبين' }, type: AccountType.ASSET },
  { code: ACCOUNT.RECEIVABLES, name: { en: 'Customer receivables', ar: 'مستحقات العملاء' }, type: AccountType.ASSET },
  { code: ACCOUNT.INVENTORY, name: { en: 'Inventory', ar: 'المخزون' }, type: AccountType.ASSET },
  { code: ACCOUNT.GOODS_AWAITING_DELIVERY, name: { en: 'Goods awaiting delivery', ar: 'بضاعة بانتظار التسليم' }, type: AccountType.ASSET },
  { code: ACCOUNT.PAYABLES, name: { en: 'Supplier payables', ar: 'مستحقات الموردين' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.REFUNDS_PAYABLE, name: { en: 'Refunds approved, not yet paid', ar: 'مرتجعات مستحقة الدفع' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.CUSTOMER_DEPOSITS, name: { en: 'Customer deposits and credits', ar: 'دفعات وأرصدة العملاء' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.TAX_PAYABLE, name: { en: 'Tax payable', ar: 'ضرائب مستحقة' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.EQUITY, name: { en: 'Owner equity and opening balances', ar: 'حقوق الملكية والأرصدة الافتتاحية' }, type: AccountType.EQUITY },
  { code: ACCOUNT.PRODUCT_SALES, name: { en: 'Product sales', ar: 'مبيعات المنتجات' }, type: AccountType.REVENUE },
  { code: ACCOUNT.SALES_DISCOUNTS, name: { en: 'Sales discounts', ar: 'خصومات المبيعات' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.SALES_RETURNS, name: { en: 'Sales returns', ar: 'مردودات المبيعات' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.DELIVERY_INCOME, name: { en: 'Delivery income', ar: 'إيرادات التوصيل' }, type: AccountType.REVENUE },
  { code: ACCOUNT.DELIVERY_REFUNDS, name: { en: 'Delivery-fee refunds', ar: 'رد رسوم التوصيل' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.COGS, name: { en: 'Cost of goods sold', ar: 'تكلفة البضاعة المباعة' }, type: AccountType.COST_OF_SALES },
  { code: ACCOUNT.INVENTORY_LOSSES, name: { en: 'Inventory losses and stock-take differences', ar: 'خسائر وفروق جرد المخزون' }, type: AccountType.COST_OF_SALES },
  { code: ACCOUNT.DELIVERY_COSTS, name: { en: 'Delivery and courier costs', ar: 'تكاليف التوصيل والمندوبين' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.RENT, name: { en: 'Rent', ar: 'الإيجار' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.SALARIES, name: { en: 'Salaries and wages', ar: 'الرواتب والأجور' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.MARKETING, name: { en: 'Marketing and advertising', ar: 'التسويق والإعلان' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.PACKAGING, name: { en: 'Packaging and supplies', ar: 'التغليف والمستلزمات' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.FEES, name: { en: 'Bank and service fees', ar: 'رسوم بنكية وخدمات' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.UTILITIES, name: { en: 'Utilities and internet', ar: 'المرافق والإنترنت' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.OTHER_EXPENSES, name: { en: 'Other operating expenses', ar: 'مصروفات تشغيل أخرى' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.UNCOLLECTIBLE, name: { en: 'Uncollectible receivables', ar: 'ديون معدومة' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.CASH_OVER_SHORT, name: { en: 'Cash over / short', ar: 'فروق النقدية' }, type: AccountType.EXPENSE },
];

export const ACCOUNT_CODES = CHART.map((a) => a.code);

/** Accounts whose balance grows with credits: liabilities, equity, revenue. */
export function isCreditNormal(code: string): boolean {
  const type = CHART.find((a) => a.code === code)?.type;
  return type === AccountType.LIABILITY || type === AccountType.EQUITY || type === AccountType.REVENUE;
}

/** Accounts a running cost can be recorded against (an expense's category). */
export const EXPENSE_ACCOUNTS: AccountCode[] = [
  ACCOUNT.DELIVERY_COSTS,
  ACCOUNT.RENT,
  ACCOUNT.SALARIES,
  ACCOUNT.MARKETING,
  ACCOUNT.PACKAGING,
  ACCOUNT.FEES,
  ACCOUNT.UTILITIES,
  ACCOUNT.OTHER_EXPENSES,
];

/** Operating expenses on the profit and loss: everything below delivery costs. */
export const OPERATING_EXPENSE_ACCOUNTS: AccountCode[] = [
  ACCOUNT.RENT,
  ACCOUNT.SALARIES,
  ACCOUNT.MARKETING,
  ACCOUNT.PACKAGING,
  ACCOUNT.FEES,
  ACCOUNT.UTILITIES,
  ACCOUNT.OTHER_EXPENSES,
  ACCOUNT.UNCOLLECTIBLE,
  ACCOUNT.CASH_OVER_SHORT,
];
