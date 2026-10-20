export type CourierType = "in_house" | "company";

/** Amounts are minor units (piastres). */
export type Courier = {
  _id: string;
  name: string;
  type: CourierType;
  phone?: string;
  isActive: boolean;
  /** COD cash they hold now: collections less refunds they paid, not yet settled. */
  heldMinor: number;
  collections: number;
};

export type Settlement = {
  _id: string;
  settlementNumber: number;
  date: string;
  collectedMinor: number;
  refundsPaidMinor: number;
  feesMinor: number;
  expectedMinor: number;
  receivedMinor: number;
  differenceMinor: number;
  differenceReason?: string;
};

export type CourierDetail = Courier & {
  payments: { _id: string; paymentNumber: number; orderNumber: number; amountMinor: number; collectedAt: string }[];
  refunds: { _id: string; refundNumber: number; orderNumber: number; totalMinor: number; executedAt: string }[];
  collectedMinor: number;
  refundsPaidMinor: number;
  settlements: Settlement[];
};
