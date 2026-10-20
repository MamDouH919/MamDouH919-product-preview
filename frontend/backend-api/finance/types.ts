/** What the customer has paid, kept apart from the order's delivery status. */
export type OrderPaymentStatus = "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded" | "written_off" | "not_tracked";

/** Who holds collected cash: the store, or a courier until they hand it over. */
export type Custody = "store" | "courier";

export type Payment = {
  _id: string;
  paymentNumber: number;
  orderNumber: number;
  /** Minor units (piastres). */
  amountMinor: number;
  status: "collected" | "voided";
  custody: Custody;
  collectedAt: string;
  recordedBy?: { name: string } | string;
  note?: string;
  voidedAt?: string;
  voidReason?: string;
};

export type OrderFinance = {
  /** Whether the sale is in the books — it is once delivered after the books started. */
  booked: boolean;
  bookedAt?: string;
  paymentStatus: OrderPaymentStatus;
  totalMinor: number;
  collectedMinor: number;
  /** Every executed refund, whatever its method. */
  refundedMinor: number;
  /** Refunds taken off what the customer owed instead of paid out. */
  creditedMinor: number;
  /** What the customer will never pay, written off. */
  writtenOffMinor: number;
  outstandingMinor: number;
  payments: Payment[];
};
