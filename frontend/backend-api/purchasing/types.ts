import { LocalizedField } from "../globalTypes";

/** Amounts are minor units (piastres) throughout. */
export type Supplier = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  taxId?: string;
  notes?: string;
  isActive: boolean;
  /** What the store owes them now. */
  owedMinor: number;
  purchases?: number;
};

export type PurchaseStatus = "draft" | "posted";

export type PurchaseLine = {
  product: string;
  variantId?: string;
  name: LocalizedField;
  variantLabel?: string;
  quantity: number;
  unitCostMinor: number;
  landedMinor: number;
  valueMinor: number;
  returnedQty: number;
  returnedMinor: number;
};

export type Purchase = {
  _id: string;
  purchaseNumber: number;
  supplier: { _id: string; name: string; phone?: string } | string;
  supplierInvoiceNo?: string;
  date: string;
  dueDate?: string;
  lines: PurchaseLine[];
  landedCostMinor: number;
  subtotalMinor: number;
  totalMinor: number;
  paidMinor: number;
  returnedMinor: number;
  status: PurchaseStatus;
  notes?: string;
  createdAt: string;
};

export type PurchaseDetail = Purchase & {
  owedMinor: number;
  returns: { _id: string; returnNumber: number; date: string; totalMinor: number; lines: { lineIndex: number; quantity: number; valueMinor: number }[]; note?: string }[];
  payments: { _id: string; paymentNumber: number; date: string; amountMinor: number; allocations: { purchase: string; amountMinor: number }[] }[];
};

export type SupplierDetail = Supplier & {
  purchases: Purchase[];
  payments: PurchaseDetail["payments"];
  returns: PurchaseDetail["returns"];
};

export type PurchasesResponse = { data: Purchase[]; total: number; page: number; limit: number };

export type SupplierInput = { name: string; phone?: string; email?: string; taxId?: string; notes?: string; isActive?: boolean };

/** Decimal strings for every amount, so no float ever carries money. */
export type PurchaseInput = {
  supplierId: string;
  supplierInvoiceNo?: string;
  date: string;
  dueDate?: string;
  lines: { productId: string; variantId?: string; quantity: number; unitCost: string }[];
  landedCost?: string;
  notes?: string;
};
