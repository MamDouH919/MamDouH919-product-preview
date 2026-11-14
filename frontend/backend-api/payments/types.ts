/** One credential a gateway needs. The settings form is drawn from these, so a new gateway needs no new form. */
export type GatewayField = {
  key: string;
  label: { en: string; ar: string };
  /** Never sent back by the API — only whether it is set. */
  secret: boolean;
  required: boolean;
  hint?: { en: string; ar: string };
  placeholder?: string;
};

export type GatewayProvider = {
  id: string;
  name: string;
  fields: GatewayField[];
  /** The saved values of the plain (non-secret) fields. */
  values: Record<string, string>;
  /** Keys of the secret fields that have a saved value. */
  secretsSet: string[];
  /** Whether everything the gateway needs is saved. */
  complete: boolean;
};

export type GatewaySettings = {
  enabled: boolean;
  provider: string | null;
  providers: GatewayProvider[];
  webhookBase: string;
};

export type UpdateGatewayInput = {
  enabled?: boolean;
  provider?: string;
  /** A blank secret keeps the saved one. */
  credentials?: Record<string, string>;
};

/** Money the gateway paid out to the store's bank (minor units). */
export type GatewayPayout = {
  _id: string;
  payoutNumber: number;
  date: string;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
  reference?: string;
  note?: string;
  status: "posted" | "reversed";
  reversalReason?: string;
};

export type GatewayPayouts = {
  /** What the books say the gateway is holding right now. */
  heldMinor: number;
  payouts: GatewayPayout[];
};

export type RecordPayoutInput = {
  date: string;
  grossAmount: string;
  feeAmount?: string;
  moneyAccountId?: string;
  reference?: string;
  note?: string;
};
