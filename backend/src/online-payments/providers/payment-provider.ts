/**
 * What a payment gateway must be able to do. The rest of the system talks to
 * this interface only, so adding a gateway (Stripe, …) is one class that
 * implements it plus one line in `providers/index.ts` — no checkout, webhook,
 * accounting or settings-form code changes.
 */

export enum GatewayId {
  PAYMOB = 'paymob',
  // STRIPE = 'stripe',
}

/** One credential the store must give a gateway. The settings form is drawn from these. */
export interface CredentialField {
  key: string;
  label: { en: string; ar: string };
  /** Encrypted at rest and never sent back to the dashboard (only whether it is set). */
  secret: boolean;
  required: boolean;
  hint?: { en: string; ar: string };
  placeholder?: string;
}

export type Credentials = Record<string, string>;

export interface CheckoutInput {
  /** Our id for this attempt; the gateway echoes it back in the webhook. */
  reference: string;
  amountMinor: number;
  currencyCode: string;
  orderNumber: number;
  customer: { name: string; email?: string; phone?: string };
  /** Where the gateway reports the result to us. */
  notificationUrl: string;
  /** Where the customer lands after paying. Display only — never proof of payment. */
  returnUrl: string;
}

export interface CheckoutResult {
  /** Where to send the customer to pay. */
  checkoutUrl: string;
}

export interface WebhookRequest {
  body: unknown;
  /** The request body exactly as received, for gateways that sign the bytes. */
  rawBody?: Buffer;
  query: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

export type WebhookEvent =
  | {
      kind: 'paid' | 'failed';
      /** The attempt reference we gave the gateway. */
      reference: string;
      transactionId: string;
      amountMinor: number;
      currencyCode: string;
    }
  /** Authentic, but nothing for us to do (a refund notice, a token event…). */
  | { kind: 'ignored' };

export interface PaymentProvider {
  readonly id: GatewayId;
  readonly name: string;
  readonly fields: readonly CredentialField[];

  /** Throws a readable error when a credential is missing or malformed. */
  assertCredentials(credentials: Credentials): void;

  createCheckout(credentials: Credentials, input: CheckoutInput): Promise<CheckoutResult>;

  /**
   * Proves the request came from the gateway (signature) and says what
   * happened. Throws `UnauthorizedException` for a forged or altered request —
   * nothing in the body is trusted before this passes.
   */
  parseWebhook(credentials: Credentials, request: WebhookRequest): WebhookEvent;

  /**
   * Asks the gateway directly what became of an attempt — the fallback for a
   * notice that never arrived. Optional: a gateway without the call (or a
   * store that gave no key for it) just waits for the notice. `ignored`
   * means nothing is known yet.
   */
  inquire?(credentials: Credentials, reference: string): Promise<WebhookEvent>;

  /** Gives money back on a transaction. */
  refund(credentials: Credentials, input: { transactionId: string; amountMinor: number }): Promise<void>;
}
