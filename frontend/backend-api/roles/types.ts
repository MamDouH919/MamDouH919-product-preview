export type PermissionAction = "create" | "read" | "update" | "delete" | "approve" | "request" | "execute";

export type RolePermission = {
  resource: string;
  actions: PermissionAction[];
};

export type Role = {
  _id: string;
  name: string;
  permissions: RolePermission[];
  /** How many staff accounts hold the role. */
  usersCount: number;
  /** The admin role: every permission, never edited or deleted from the dashboard. */
  builtIn: boolean;
};

export type RolePayload = {
  name: string;
  permissions: RolePermission[];
};
