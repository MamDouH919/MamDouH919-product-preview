import config from "@/config.json";

/** What the store is sold as; set on the platform, never by the store. Mirrors the API's StorePlan. */
export type StorePlan = "catalog" | "full";

/** The parts of the system a plan switches on. Products and the website are always on. */
export type StoreModule = "orders" | "inventory" | "finance";

/** What a store gets when its settings haven't said otherwise — the API's default plan. */
export const ALL_MODULES: readonly StoreModule[] = ["orders", "inventory", "finance"];

/**
 * Routes that need modules, matched as a prefix of the path after the locale.
 * The API answers 404 to these on a store without them; this keeps the site
 * and dashboard from offering a page that would only fail.
 */
const ROUTE_MODULES: [string, StoreModule[]][] = [
    // Storefront
    ["/cart", ["orders"]],
    ["/checkout", ["orders"]],
    ["/orders", ["orders"]],
    ["/account", ["orders"]],
    ["/track", ["orders"]],
    ["/cart-reminders", ["orders"]],
    // Dashboard
    ["/admin/orders", ["orders"]],
    ["/admin/returns", ["orders"]],
    ["/admin/refunds", ["orders", "finance"]],
    ["/admin/coupons", ["orders"]],
    ["/admin/customers", ["orders"]],
    ["/admin/couriers", ["orders", "finance"]],
    ["/admin/price-list", ["orders"]],
    ["/admin/inventory", ["inventory"]],
    ["/admin/purchases", ["inventory", "finance"]],
    ["/admin/suppliers", ["inventory", "finance"]],
    ["/admin/reports", ["finance"]],
    ["/admin/money-accounts", ["finance"]],
    ["/admin/expenses", ["finance"]],
    ["/admin/books", ["finance"]],
];

const LOCALES = config.app.languages as string[];

/** The modules a path needs. Takes it with or without the leading locale ("/ar/admin/orders" or "/admin/orders"). */
export function requiredModules(pathname: string): StoreModule[] {
    const segments = pathname.split("/");
    const path = LOCALES.includes(segments[1]) ? "/" + segments.slice(2).join("/") : pathname;
    const match = ROUTE_MODULES.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
    return match?.[1] ?? [];
}
