/** What a store is sold as: a showcase of its products, or the whole online shop. */
export enum StorePlan {
  /** Products, categories, pages and the rest of the website — nothing is bought online. */
  CATALOG = 'catalog',
  /**
   * Online orders, customers, coupons, returns and delivery prices, without
   * stock, purchases, couriers or the books: the store sells online and keeps
   * its stock and money outside the system. Final: such a store is never
   * moved to FULL, since it has no books to start them from.
   */
  ORDERS = 'orders',
  /**
   * Online orders plus stock: orders take stock off the shelf and returns put
   * it back, but there are no books, purchases, suppliers or couriers. Money
   * is followed by a plain cash-in/cash-out page instead. Final, like ORDERS:
   * never moved to FULL, since it has no books to start them from.
   */
  STOCK = 'stock',
  /** Everything: online orders, stock and the books. */
  FULL = 'full',
}

/**
 * The parts of the system a plan switches on. The catalog and website
 * (products, categories, banners, sections, pages, reviews, contact) are
 * always on and have no module.
 */
export enum StoreModule {
  /** Cart, checkout, orders, customer accounts, coupons, returns and delivery. */
  ORDERS = 'orders',
  /** Stock levels, purchases and suppliers. */
  INVENTORY = 'inventory',
  /** The books: accounts, expenses, refunds and statements. */
  FINANCE = 'finance',
  /**
   * Staff accounts and the roles that decide what they may do. A paid add-on,
   * not part of any plan: the platform switches it on per store (`team`), on
   * top of whatever the plan already gives.
   */
  TEAM = 'team',
  /**
   * Paying for orders online through the store's own payment gateway account
   * (Paymob, Stripe…). A paid add-on like TEAM: the platform switches it on
   * per store (`onlinePayments`); the store then enters its own gateway keys.
   */
  ONLINE_PAYMENTS = 'online_payments',
}

/**
 * Plans are bundles of modules, so code checks the module it needs and never
 * the plan's name — a new plan is a new line here.
 */
export const PLAN_MODULES: Record<StorePlan, readonly StoreModule[]> = {
  [StorePlan.CATALOG]: [],
  [StorePlan.ORDERS]: [StoreModule.ORDERS],
  [StorePlan.STOCK]: [StoreModule.ORDERS, StoreModule.INVENTORY],
  [StorePlan.FULL]: [StoreModule.ORDERS, StoreModule.INVENTORY, StoreModule.FINANCE],
};

/** Stores registered before plans existed sold online, so they keep everything. */
export const DEFAULT_PLAN = StorePlan.FULL;
