import { BadGatewayException, BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CheckoutInput,
  CheckoutResult,
  CredentialField,
  Credentials,
  GatewayId,
  PaymentProvider,
  WebhookEvent,
  WebhookRequest,
} from './payment-provider';

const DEFAULT_BASE = 'https://accept.paymob.com';
const TIMEOUT_MS = 15_000;

/**
 * The fields Paymob signs on a "transaction processed" callback, in the order
 * it signs them (alphabetical by name). Values are joined with no separator.
 */
const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

const pick = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), obj);

/** Paymob (Egypt and its sister regions), through the Intention API and Unified Checkout. */
@Injectable()
export class PaymobProvider implements PaymentProvider {
  private readonly logger = new Logger(PaymobProvider.name);

  readonly id = GatewayId.PAYMOB;
  readonly name = 'Paymob';
  readonly fields: readonly CredentialField[] = [
    {
      key: 'secretKey',
      label: { en: 'Secret key', ar: 'المفتاح السري (Secret key)', es: 'Clave secreta (Secret key)' },
      secret: true,
      required: true,
      placeholder: 'egy_sk_…',
      hint: { en: 'Paymob dashboard → Settings → Account info. Never shared with the storefront.', ar: 'من لوحة Paymob ← Settings ← Account info. لا يظهر للموقع أبدًا.', es: 'Desde el panel de Paymob → Settings → Account info. Nunca se muestra en la tienda.' },
    },
    {
      key: 'publicKey',
      label: { en: 'Public key', ar: 'المفتاح العام (Public key)', es: 'Clave pública (Public key)' },
      secret: false,
      required: true,
      placeholder: 'egy_pk_…',
    },
    {
      key: 'hmacSecret',
      label: { en: 'HMAC secret', ar: 'مفتاح HMAC', es: 'Clave HMAC' },
      secret: true,
      required: true,
      hint: { en: 'Used to verify that payment notifications really come from Paymob.', ar: 'للتأكد إن إشعارات الدفع جاية فعلًا من Paymob.', es: 'Sirve para comprobar que las notificaciones de pago proceden realmente de Paymob.' },
    },
    {
      key: 'apiKey',
      label: { en: 'API key (optional)', ar: 'مفتاح API (اختياري)', es: 'Clave de API (opcional)' },
      secret: true,
      required: false,
      hint: {
        en: 'Lets the store ask Paymob directly if a payment notice is late. Paymob dashboard → Settings → Account info.',
        ar: 'يسمح للمتجر بسؤال Paymob مباشرة لو تأخر إشعار الدفع. من لوحة Paymob ← Settings ← Account info.', es: 'Permite a la tienda consultar a Paymob directamente si se retrasa un aviso de pago. Panel de Paymob → Settings → Account info.',
      },
    },
    {
      key: 'integrationIds',
      label: { en: 'Integration IDs', ar: 'أرقام الـ Integrations', es: 'IDs de Integrations' },
      secret: false,
      required: true,
      placeholder: '123456, 123457',
      hint: { en: 'One per payment method (card, wallet…), comma separated. Online card integration is the usual one.', ar: 'رقم لكل وسيلة دفع (كارت، محفظة…) مفصولة بفاصلة.', es: 'Uno por método de pago (tarjeta, monedero…), separados por comas. La integración de tarjeta en línea es la habitual.' },
    },
    {
      key: 'apiBase',
      label: { en: 'API address', ar: 'عنوان الـ API', es: 'Dirección de la API' },
      secret: false,
      required: false,
      placeholder: DEFAULT_BASE,
      hint: { en: 'Leave empty for Egypt. Other regions: the address in your Paymob dashboard.', ar: 'سيبه فاضي لمصر. المناطق الأخرى: العنوان من لوحة Paymob.', es: 'Déjalo vacío para Egipto. Otras regiones: la dirección de tu panel de Paymob.' },
    },
  ];

  assertCredentials(credentials: Credentials): void {
    const missing = this.fields.filter((f) => f.required && !credentials[f.key]?.trim()).map((f) => f.key);
    if (missing.length) throw new BadRequestException(`Paymob is missing: ${missing.join(', ')}`);
    this.integrationIds(credentials);
    this.base(credentials);
  }

  async createCheckout(credentials: Credentials, input: CheckoutInput): Promise<CheckoutResult> {
    this.assertCredentials(credentials);
    const base = this.base(credentials);
    const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);

    // One line carrying the whole total: the order already priced its lines,
    // discount and delivery, and Paymob wants the items to add up to the amount.
    const body = {
      amount: input.amountMinor,
      currency: input.currencyCode,
      payment_methods: this.integrationIds(credentials),
      items: [{ name: `Order #${input.orderNumber}`, amount: input.amountMinor, description: `Order #${input.orderNumber}`, quantity: 1 }],
      billing_data: {
        first_name: firstName || 'NA',
        last_name: rest.join(' ') || 'NA',
        email: input.customer.email || 'NA',
        phone_number: input.customer.phone || 'NA',
        country: 'NA',
        city: 'NA',
        street: 'NA',
        building: 'NA',
        floor: 'NA',
        apartment: 'NA',
      },
      special_reference: input.reference,
      notification_url: input.notificationUrl,
      redirection_url: input.returnUrl,
    };

    const response = await this.request(`${base}/v1/intention/`, credentials.secretKey.trim(), body);
    const clientSecret = (response as { client_secret?: string }).client_secret;
    if (!clientSecret) throw new BadGatewayException('Paymob did not return a checkout');

    // Paymob's docs send Egypt's customers to eg.checkout.paymob.com. Other regions
    // keep the checkout path on their own API address.
    const url = new URL(base === DEFAULT_BASE ? 'https://eg.checkout.paymob.com/' : `${base}/unifiedcheckout/`);
    url.searchParams.set('publicKey', credentials.publicKey.trim());
    url.searchParams.set('clientSecret', clientSecret);
    return { checkoutUrl: url.toString() };
  }

  parseWebhook(credentials: Credentials, request: WebhookRequest): WebhookEvent {
    const body = request.body as { type?: string; obj?: unknown } | undefined;
    const received = request.query.hmac;
    if (!body?.obj || typeof received !== 'string' || !credentials.hmacSecret) {
      throw new UnauthorizedException('Unsigned notification');
    }

    const signed = HMAC_FIELDS.map((field) => String(pick(body.obj, field) ?? '')).join('');
    const expected = createHmac('sha512', credentials.hmacSecret.trim()).update(signed).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received.toLowerCase(), 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Bad signature');
    }

    // Only a transaction notice is ours to act on; the others (card tokens…) are acknowledged and dropped.
    if (body.type !== 'TRANSACTION') return { kind: 'ignored' };
    return this.toEvent(body.obj as Record<string, unknown>);
  }

  /** What a transaction says about an attempt, from a notice or an inquiry. */
  private toEvent(tx: Record<string, unknown>, fallbackReference?: string): WebhookEvent {
    // Refunds and voids arrive as their own transactions; they are not payments.
    if (tx.is_refunded === true || tx.is_voided === true || tx.is_capture === true || tx.has_parent_transaction === true) {
      return { kind: 'ignored' };
    }
    // Still in flight (e.g. waiting for 3-D Secure): wait for the final notice.
    if (tx.pending === true) return { kind: 'ignored' };

    const reference = (pick(tx, 'order.merchant_order_id') as string | null | undefined) || fallbackReference;
    const amountMinor = Number(tx.amount_cents);
    if (typeof reference !== 'string' || !reference || !Number.isInteger(amountMinor) || tx.id === undefined) {
      return { kind: 'ignored' };
    }
    return {
      kind: tx.success === true ? 'paid' : 'failed',
      reference,
      transactionId: String(tx.id),
      amountMinor,
      currencyCode: String(tx.currency ?? ''),
    };
  }

  /**
   * What Paymob says became of an attempt, by the `special_reference` we gave it:
   * `POST /api/auth/tokens` (API key → token), then `POST /api/ecommerce/orders/transaction_inquiry`
   * (per Paymob's reference, 14 Nov 2026). Needs the optional API key; without it, or when Paymob
   * has no transaction yet, it says nothing is known.
   */
  async inquire(credentials: Credentials, reference: string): Promise<WebhookEvent> {
    if (!credentials.apiKey?.trim()) return { kind: 'ignored' };
    const base = this.base(credentials);
    try {
      const auth = (await this.request(`${base}/api/auth/tokens`, '', { api_key: credentials.apiKey.trim() }, false)) as { token?: string };
      if (!auth.token) return { kind: 'ignored' };
      const tx = (await this.request(
        `${base}/api/ecommerce/orders/transaction_inquiry`,
        '',
        { auth_token: auth.token, merchant_order_id: reference },
        false,
      )) as Record<string, unknown>;
      return this.toEvent(tx, reference);
    } catch (error) {
      // Nothing there yet, or Paymob is busy: the notice (or the next ask) will settle it.
      this.logger.debug(`Paymob inquiry for ${reference}: ${(error as Error).message}`);
      return { kind: 'ignored' };
    }
  }

  /**
   * Refund by transaction id: `POST /api/acceptance/void_refund/refund` with the secret key as
   * `Authorization: Token …`. Tried in Paymob's sandbox (14 Nov 2026): the payment showed as
   * refunded and a Refund transaction for the same amount was created. Paymob's reference was
   * not available to check against, so only the behaviour seen there is relied on.
   */
  async refund(credentials: Credentials, input: { transactionId: string; amountMinor: number }): Promise<void> {
    this.assertCredentials(credentials);
    await this.request(
      `${this.base(credentials)}/api/acceptance/void_refund/refund`,
      credentials.secretKey.trim(),
      { transaction_id: Number(input.transactionId), amount_cents: input.amountMinor },
    );
  }

  private async request(url: string, secretKey: string, body: unknown, withToken = true): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(withToken ? { Authorization: `Token ${secretKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Paymob unreachable: ${error instanceof Error ? error.message : error}`);
      throw new BadGatewayException('Could not reach Paymob. Try again in a moment.');
    }
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    if (!response.ok) {
      // Paymob's own message is useful to the store admin (wrong key, bad integration id); it carries no secret.
      this.logger.warn(`Paymob ${response.status}: ${text.slice(0, 300)}`);
      const detail = typeof json === 'object' && json ? JSON.stringify(json).slice(0, 200) : '';
      throw new BadGatewayException(`Paymob refused the request (${response.status}) ${detail}`.trim());
    }
    return json;
  }

  private integrationIds(credentials: Credentials): number[] {
    const ids = credentials.integrationIds
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('Integration IDs must be numbers separated by commas');
    }
    return ids;
  }

  /**
   * The API address, which a store admin types. Pinned to Paymob's own hosts
   * over https, so the field can't be used to make the server call somewhere else.
   */
  private base(credentials: Credentials): string {
    const raw = credentials.apiBase?.trim() || DEFAULT_BASE;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('The API address is not a valid URL');
    }
    if (url.protocol !== 'https:' || !(url.hostname === 'paymob.com' || url.hostname.endsWith('.paymob.com'))) {
      throw new BadRequestException('The API address must be an https paymob.com address');
    }
    return url.origin;
  }
}
