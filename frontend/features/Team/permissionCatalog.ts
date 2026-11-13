import type { StoreModule } from "@/lib/storeModules";
import type { PermissionAction } from "@/backend-api/roles/types";

export type PermissionResource = {
  /** The API's resource name. */
  slug: string;
  /** Only the actions the API actually checks for this resource. */
  actions: PermissionAction[];
  /** The store must have all of these for the area to exist. */
  modules?: StoreModule[];
};

export type PermissionGroup = {
  id: "catalog" | "sales" | "stock" | "finance" | "website" | "admin";
  resources: PermissionResource[];
};

const CRUD: PermissionAction[] = ["create", "read", "update", "delete"];
const WRITE: PermissionAction[] = ["create", "update", "delete"];

/**
 * What a role can grant, grouped as the dashboard menu is. Areas a store's
 * plan leaves out are hidden in the editor, but a role keeps whatever it
 * already holds there. Closing periods ("finance") is left out on purpose:
 * only the store's own super admin may do it, whatever a role says.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "catalog",
    resources: [
      { slug: "products", actions: CRUD },
      { slug: "categories", actions: WRITE },
      { slug: "sub-categories", actions: WRITE },
      { slug: "reviews", actions: ["read", "update", "delete"] },
    ],
  },
  {
    id: "sales",
    resources: [
      { slug: "orders", actions: ["read", "update"], modules: ["orders"] },
      { slug: "customers", actions: ["read", "update"], modules: ["orders"] },
      { slug: "coupons", actions: CRUD, modules: ["orders"] },
      { slug: "price-list", actions: CRUD, modules: ["orders"] },
      { slug: "refunds", actions: ["read", "request", "approve", "execute"], modules: ["orders", "finance"] },
      { slug: "settlements", actions: ["read", "create", "update", "execute"], modules: ["orders", "finance"] },
    ],
  },
  {
    id: "stock",
    resources: [
      { slug: "inventory", actions: CRUD, modules: ["inventory"] },
      { slug: "purchases", actions: ["read", "create", "update", "delete", "execute"], modules: ["inventory", "finance"] },
    ],
  },
  {
    id: "finance",
    resources: [
      { slug: "payments", actions: ["read", "create", "approve"], modules: ["orders", "finance"] },
      { slug: "expenses", actions: ["read", "create", "approve"], modules: ["finance"] },
      { slug: "money-accounts", actions: ["create", "update", "execute"], modules: ["finance"] },
      { slug: "finance-reports", actions: ["read"], modules: ["finance"] },
    ],
  },
  {
    id: "website",
    resources: [
      { slug: "pages", actions: CRUD },
      { slug: "banners", actions: WRITE },
      { slug: "sections", actions: WRITE },
      { slug: "contact", actions: ["read", "update", "delete"] },
      { slug: "subscribe", actions: ["read", "delete"] },
    ],
  },
  {
    id: "admin",
    resources: [
      { slug: "settings", actions: ["read", "update"] },
      { slug: "activity-log", actions: ["read"] },
      { slug: "users", actions: CRUD, modules: ["team"] },
      { slug: "roles", actions: CRUD, modules: ["team"] },
    ],
  },
];
