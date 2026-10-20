export enum Resource {
  USERS = 'users',
  Roles = 'roles',
  TEAMS = 'teams',
  BANNERS = 'banners',
  SETTINGS = 'settings',
  SECTIONS = 'sections',
  SERVICES = 'services',
  TESTIMONIALS = 'testimonials',
  CONTACT = 'contact',
  NEWS = 'news',
  SUBSCRIBE = 'subscribe',
  PARTNERS = 'partners',
  JUDGMENTS = 'judgments',
  CATEGORIES = 'categories',
  SUB_CATEGORIES = 'sub-categories',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  CUSTOMERS = 'customers',
  ORDERS = 'orders',
  COUPONS = 'coupons',
  PAGES = 'pages',
  PRICE_LIST = 'price-list',
  REVIEWS = 'reviews',
  ACTIVITY_LOG = 'activity-log',
  /** Recording and voiding customer collections. */
  PAYMENTS = 'payments',
  /** Financial reports: net sales, receivables, cash. */
  FINANCE_REPORTS = 'finance-reports',
  /** Money given back to customers: request, approve, execute. */
  REFUNDS = 'refunds',
  /** Suppliers, purchases, returns to suppliers and paying them. */
  PURCHASES = 'purchases',
  /** Couriers and the COD cash they hand over. */
  SETTLEMENTS = 'settlements',
  /** The store's running costs. */
  EXPENSES = 'expenses',
  /** The store's cash boxes, bank accounts and wallets, and moving money between them. */
  MONEY_ACCOUNTS = 'money-accounts',
  /** Closing periods: the store's own super admin only, checked in the service too. */
  FINANCE = 'finance',
}