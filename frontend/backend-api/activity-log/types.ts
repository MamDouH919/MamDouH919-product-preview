export type ActivityAction = "create" | "update" | "delete";

export type ActivityLogEntry = {
  _id: string;
  user: string;
  userName?: string;
  userEmail?: string;
  resource: string;
  action: ActivityAction;
  method: string;
  path: string;
  entityId?: string;
  entityLabel?: string;
  fields: string[];
  ip?: string;
  createdAt: string;
};

export type ActivityLogFilters = {
  userId?: string;
  resource?: string;
  action?: ActivityAction;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type ActivityLogResponse = { data: ActivityLogEntry[]; total: number; page: number; limit: number };

export type ActivityLogFacets = {
  users: { _id: string; name?: string; email?: string }[];
  resources: string[];
};
