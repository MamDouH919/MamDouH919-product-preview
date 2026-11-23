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
  GATEWAY_BALANCE: '1150',
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
  name: { en: string; ar: string; es: string };
  type: AccountType;
}

export const CHART: AccountInfo[] = [
  { code: ACCOUNT.CASH, name: { en: 'Cash on hand', ar: 'النقدية بالصندوق', es: 'Efectivo en caja' }, type: AccountType.ASSET },
  { code: ACCOUNT.COURIER_CASH, name: { en: 'COD cash held by couriers', ar: 'نقدية التحصيل لدى المندوبين', es: 'Efectivo de contra reembolso en poder de los mensajeros' }, type: AccountType.ASSET },
  { code: ACCOUNT.GATEWAY_BALANCE, name: { en: 'Online payments held by the gateway', ar: 'مدفوعات أونلاين لدى بوابة الدفع', es: 'Pagos en línea retenidos por la pasarela' }, type: AccountType.ASSET },
  { code: ACCOUNT.RECEIVABLES, name: { en: 'Customer receivables', ar: 'مستحقات علي العملاء', es: 'Cuentas por cobrar de clientes' }, type: AccountType.ASSET },
  { code: ACCOUNT.INVENTORY, name: { en: 'Inventory', ar: 'المخزون', es: 'Inventario' }, type: AccountType.ASSET },
  { code: ACCOUNT.GOODS_AWAITING_DELIVERY, name: { en: 'Goods awaiting delivery', ar: 'بضاعة بانتظار التسليم', es: 'Mercancía pendiente de entrega' }, type: AccountType.ASSET },
  { code: ACCOUNT.PAYABLES, name: { en: 'Supplier payables', ar: 'مستحقات الموردين', es: 'Cuentas por pagar a proveedores' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.REFUNDS_PAYABLE, name: { en: 'Refunds approved, not yet paid', ar: 'مرتجعات مستحقة الدفع', es: 'Reembolsos aprobados, aún sin pagar' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.CUSTOMER_DEPOSITS, name: { en: 'Customer deposits and credits', ar: 'دفعات وأرصدة العملاء', es: 'Depósitos y saldos a favor de clientes' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.TAX_PAYABLE, name: { en: 'Tax payable', ar: 'ضرائب مستحقة', es: 'Impuestos por pagar' }, type: AccountType.LIABILITY },
  { code: ACCOUNT.EQUITY, name: { en: 'Owner equity and opening balances', ar: 'حقوق الملكية والأرصدة الافتتاحية', es: 'Patrimonio del propietario y saldos iniciales' }, type: AccountType.EQUITY },
  { code: ACCOUNT.PRODUCT_SALES, name: { en: 'Product sales', ar: 'مبيعات المنتجات', es: 'Ventas de productos' }, type: AccountType.REVENUE },
  { code: ACCOUNT.SALES_DISCOUNTS, name: { en: 'Sales discounts', ar: 'خصومات المبيعات', es: 'Descuentos sobre ventas' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.SALES_RETURNS, name: { en: 'Sales returns', ar: 'مردودات المبيعات', es: 'Devoluciones sobre ventas' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.DELIVERY_INCOME, name: { en: 'Delivery income', ar: 'إيرادات التوصيل', es: 'Ingresos por envíos' }, type: AccountType.REVENUE },
  { code: ACCOUNT.DELIVERY_REFUNDS, name: { en: 'Delivery-fee refunds', ar: 'رد رسوم التوصيل', es: 'Reembolsos de costes de envío' }, type: AccountType.CONTRA_REVENUE },
  { code: ACCOUNT.COGS, name: { en: 'Cost of goods sold', ar: 'تكلفة البضاعة المباعة', es: 'Coste de las mercancías vendidas' }, type: AccountType.COST_OF_SALES },
  { code: ACCOUNT.INVENTORY_LOSSES, name: { en: 'Inventory losses and stock-take differences', ar: 'خسائر وفروق جرد المخزون', es: 'Pérdidas de inventario y diferencias de recuento' }, type: AccountType.COST_OF_SALES },
  { code: ACCOUNT.DELIVERY_COSTS, name: { en: 'Delivery and courier costs', ar: 'تكاليف التوصيل والمندوبين', es: 'Costes de envío y mensajería' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.RENT, name: { en: 'Rent', ar: 'الإيجار', es: 'Alquiler' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.SALARIES, name: { en: 'Salaries and wages', ar: 'الرواتب والأجور', es: 'Sueldos y salarios' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.MARKETING, name: { en: 'Marketing and advertising', ar: 'التسويق والإعلان', es: 'Marketing y publicidad' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.PACKAGING, name: { en: 'Packaging and supplies', ar: 'التغليف والمستلزمات', es: 'Embalaje y suministros' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.FEES, name: { en: 'Bank and service fees', ar: 'رسوم بنكية وخدمات', es: 'Comisiones bancarias y de servicios' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.UTILITIES, name: { en: 'Utilities and internet', ar: 'المرافق والإنترنت', es: 'Suministros e internet' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.OTHER_EXPENSES, name: { en: 'Other operating expenses', ar: 'مصروفات تشغيل أخرى', es: 'Otros gastos de explotación' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.UNCOLLECTIBLE, name: { en: 'Uncollectible receivables', ar: 'ديون معدومة', es: 'Cuentas incobrables' }, type: AccountType.EXPENSE },
  { code: ACCOUNT.CASH_OVER_SHORT, name: { en: 'Cash over / short', ar: 'فروق النقدية', es: 'Sobrantes y faltantes de caja' }, type: AccountType.EXPENSE },
];

export const ACCOUNT_CODES = CHART.map((a) => a.code);

export type BalanceSide = 'debit' | 'credit';

/** The side a healthy balance sits on: credit for liabilities, equity and revenue, debit for the rest. */
export function normalSideOf(type: AccountType): BalanceSide {
  return type === AccountType.LIABILITY || type === AccountType.EQUITY || type === AccountType.REVENUE ? 'credit' : 'debit';
}

/** Accounts whose balance grows with credits: liabilities, equity, revenue. */
export function isCreditNormal(code: string): boolean {
  const type = CHART.find((a) => a.code === code)?.type;
  return type !== undefined && normalSideOf(type) === 'credit';
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

/** The five headings a chart of accounts is read under. */
export enum AccountCategory {
  ASSETS = 'assets',
  LIABILITIES = 'liabilities',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSES = 'expenses',
}

export const CATEGORY_OF: Record<AccountType, AccountCategory> = {
  [AccountType.ASSET]: AccountCategory.ASSETS,
  [AccountType.LIABILITY]: AccountCategory.LIABILITIES,
  [AccountType.EQUITY]: AccountCategory.EQUITY,
  [AccountType.REVENUE]: AccountCategory.REVENUE,
  [AccountType.CONTRA_REVENUE]: AccountCategory.REVENUE,
  [AccountType.COST_OF_SALES]: AccountCategory.EXPENSES,
  [AccountType.EXPENSE]: AccountCategory.EXPENSES,
};

/**
 * The first digit an account's code starts with, by type — the usual
 * numbering, so a code alone tells where an account sits.
 */
export const CODE_PREFIXES: Record<AccountType, string[]> = {
  [AccountType.ASSET]: ['1'],
  [AccountType.LIABILITY]: ['2'],
  [AccountType.EQUITY]: ['3'],
  [AccountType.REVENUE]: ['4'],
  [AccountType.CONTRA_REVENUE]: ['4'],
  [AccountType.COST_OF_SALES]: ['5'],
  [AccountType.EXPENSE]: ['6', '7', '8', '9'],
};

/** Where cash moving against an account is shown on the cash-flow statement. */
export enum CashFlowActivity {
  OPERATING = 'operating',
  INVESTING = 'investing',
  FINANCING = 'financing',
}

/** Built-in accounts are operating, except owner equity (capital in, drawings out). */
export const SYSTEM_ACTIVITY: Partial<Record<AccountCode, CashFlowActivity>> = {
  [ACCOUNT.EQUITY]: CashFlowActivity.FINANCING,
};

/**
 * Built-in accounts a manual entry may not touch: each is a sub-ledger that
 * the reconciliation proves equal to its own documents (orders, stock,
 * purchases, refunds, settlements), so only those documents move it. A
 * manual line here would break that check with nothing to fix it.
 */
export const MANUAL_LOCKED_ACCOUNTS: AccountCode[] = [
  ACCOUNT.COURIER_CASH,
  ACCOUNT.GATEWAY_BALANCE,
  ACCOUNT.RECEIVABLES,
  ACCOUNT.INVENTORY,
  ACCOUNT.GOODS_AWAITING_DELIVERY,
  ACCOUNT.PAYABLES,
  ACCOUNT.REFUNDS_PAYABLE,
  ACCOUNT.PRODUCT_SALES,
  ACCOUNT.SALES_DISCOUNTS,
  ACCOUNT.SALES_RETURNS,
  ACCOUNT.DELIVERY_INCOME,
  ACCOUNT.DELIVERY_REFUNDS,
  ACCOUNT.COGS,
  ACCOUNT.INVENTORY_LOSSES,
  ACCOUNT.UNCOLLECTIBLE,
  ACCOUNT.CASH_OVER_SHORT,
];

/** One account as the chart lists it: built-in or added by the store. */
export interface ChartAccount {
  code: string;
  name: { en: string; ar: string; es: string };
  type: AccountType;
  category: AccountCategory;
  normalSide: BalanceSide;
  cashFlowActivity: CashFlowActivity;
  /** Built in: fixed code, name and type; the store can't change or remove it. */
  isSystem: boolean;
  isActive: boolean;
  /** Whether a manual journal entry may post to it. */
  allowsManual: boolean;
  description?: string;
}

export const SYSTEM_CHART: ChartAccount[] = CHART.map((a) => ({
  code: a.code,
  name: a.name,
  type: a.type,
  category: CATEGORY_OF[a.type],
  normalSide: normalSideOf(a.type),
  cashFlowActivity: SYSTEM_ACTIVITY[a.code] ?? CashFlowActivity.OPERATING,
  isSystem: true,
  isActive: true,
  allowsManual: !MANUAL_LOCKED_ACCOUNTS.includes(a.code),
}));
