/** What a store is sold as: a showcase of its products, or the whole online shop. */
export enum StorePlan {
  /** Products, categories, pages and the rest of the website — nothing is bought online. */
  CATALOG = 'catalog',
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
}

/**
 * Plans are bundles of modules, so code checks the module it needs and never
 * the plan's name — a new plan is a new line here.
 */
export const PLAN_MODULES: Record<StorePlan, readonly StoreModule[]> = {
  [StorePlan.CATALOG]: [],
  [StorePlan.FULL]: [StoreModule.ORDERS, StoreModule.INVENTORY, StoreModule.FINANCE],
};

/** Stores registered before plans existed sold online, so they keep everything. */
export const DEFAULT_PLAN = StorePlan.FULL;
