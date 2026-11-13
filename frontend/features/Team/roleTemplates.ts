import type { PermissionAction } from "@/backend-api/roles/types";

export type RoleTemplate = {
  /** Key under `team.templates` for the name and description. */
  id: string;
  /** Resource slug -> actions, only ones the permission catalog offers. */
  grants: Record<string, PermissionAction[]>;
};

const CRUD: PermissionAction[] = ["create", "read", "update", "delete"];
const WRITE: PermissionAction[] = ["create", "update", "delete"];
const READ: PermissionAction[] = ["read"];

/**
 * Ready-made starting points for the usual jobs in a store. Picking one only
 * fills the form: the owner can still change it, and areas the store's plan
 * doesn't include are dropped when saving is checked server-side.
 */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "accountsManager",
    grants: {
      payments: ["read", "create", "approve"],
      expenses: ["read", "create", "approve"],
      "money-accounts": ["create", "update", "execute"],
      "finance-reports": READ,
      refunds: ["read", "approve", "execute"],
      settlements: ["read", "create", "update", "execute"],
      purchases: ["read", "execute"],
      orders: READ,
      customers: READ,
      "activity-log": READ,
    },
  },
  {
    id: "accountant",
    grants: {
      payments: ["read", "create"],
      expenses: ["read", "create"],
      "finance-reports": READ,
      refunds: ["read", "request"],
      settlements: ["read", "create"],
      purchases: READ,
      orders: READ,
    },
  },
  {
    id: "productsManager",
    grants: {
      products: CRUD,
      categories: WRITE,
      "sub-categories": WRITE,
      reviews: ["read", "update", "delete"],
      inventory: ["read", "update"],
      "price-list": CRUD,
    },
  },
  {
    id: "ordersManager",
    grants: {
      orders: ["read", "update"],
      customers: ["read", "update"],
      coupons: CRUD,
      refunds: ["read", "request"],
      settlements: ["read", "create", "update"],
      products: READ,
    },
  },
  {
    id: "customerService",
    grants: {
      orders: ["read", "update"],
      customers: ["read", "update"],
      refunds: ["read", "request"],
      reviews: ["read", "update"],
      contact: ["read", "update", "delete"],
      products: READ,
    },
  },
  {
    id: "inventoryManager",
    grants: {
      inventory: CRUD,
      purchases: ["read", "create", "update", "delete", "execute"],
      products: READ,
      orders: READ,
    },
  },
  {
    id: "warehouseKeeper",
    grants: {
      inventory: ["read", "create", "update"],
      products: READ,
      orders: READ,
    },
  },
  {
    id: "contentManager",
    grants: {
      pages: CRUD,
      banners: WRITE,
      sections: WRITE,
      contact: ["read", "update", "delete"],
      subscribe: ["read", "delete"],
      reviews: ["read", "update", "delete"],
    },
  },
  {
    id: "viewer",
    grants: {
      products: READ,
      orders: READ,
      customers: READ,
      inventory: READ,
      "finance-reports": READ,
      "activity-log": READ,
    },
  },
];
