import { splitLocale } from "@/lib/locales";
import type { PermissionAction } from "@/backend-api/roles/types";

export type PermissionMap = Record<string, string[]>;

/** The API sends a list of { resource, actions }; the app looks them up by resource. */
export const toPermissionMap = (list?: { resource: string; actions: string[] }[]): PermissionMap =>
    Object.fromEntries((list ?? []).map((p) => [p.resource, p.actions]));

/**
 * What a dashboard page needs to be opened: the "read" of the resource its
 * list comes from (the API's own rule). Matched as a prefix of the path after
 * the locale; the first match wins, so put specific paths before general ones.
 * Pages not listed here (the dashboard home, help) are open to every staff member.
 */
const ROUTE_RESOURCES: [string, string][] = [
    ["/admin/orders", "orders"],
    ["/admin/returns", "orders"],
    ["/admin/refunds", "refunds"],
    ["/admin/coupons", "coupons"],
    ["/admin/customers", "customers"],
    ["/admin/products", "products"],
    ["/admin/categories", "categories"],
    ["/admin/sub-categories", "sub-categories"],
    ["/admin/inventory", "inventory"],
    ["/admin/purchases", "purchases"],
    ["/admin/suppliers", "purchases"],
    ["/admin/couriers", "settlements"],
    ["/admin/price-list", "price-list"],
    ["/admin/reviews", "reviews"],
    ["/admin/contact", "contact"],
    ["/admin/subscribers", "subscribe"],
    ["/admin/chart-of-accounts", "finance-reports"],
    ["/admin/journal", "finance-reports"],
    ["/admin/ledger", "finance-reports"],
    ["/admin/reports", "finance-reports"],
    ["/admin/books", "finance-reports"],
    ["/admin/money-accounts", "money-accounts"],
    ["/admin/expenses", "expenses"],
    ["/admin/pages", "pages"],
    ["/admin/banners", "banners"],
    ["/admin/sections", "sections"],
    ["/admin/settings", "settings"],
    ["/admin/activity", "activity-log"],
    ["/admin/users", "users"],
    ["/admin/roles", "roles"],
];

/** The resource whose "read" a path needs, or undefined if any staff member may open it. */
export function requiredResource(pathname: string): string | undefined {
    const { locale, rest } = splitLocale(pathname);
    const path = locale ? rest || "/" : pathname;
    return ROUTE_RESOURCES.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"))?.[1];
}

export const canDo = (
    permissions: PermissionMap,
    isSuper: boolean,
    resource: string,
    action: PermissionAction,
) => isSuper || !!permissions[resource]?.includes(action);
