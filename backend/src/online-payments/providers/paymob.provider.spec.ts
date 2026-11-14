import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymobProvider } from './paymob.provider';

const HMAC = 'test-hmac-secret';
const credentials = {
  secretKey: 'egy_sk_test_x',
  publicKey: 'egy_pk_test_x',
  hmacSecret: HMAC,
  integrationIds: '111, 222',
};

/** A transaction as Paymob sends it, with the fields its signature covers. */
function transaction(overrides: Record<string, unknown> = {}) {
  return {
    amount_cents: 31500,
    created_at: '2026-11-14T10:00:00.000000',
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    id: 987654,
    integration_id: 111,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 555, merchant_order_id: 'attempt-ref-1' },
    owner: 42,
    pending: false,
    source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
    success: true,
    ...overrides,
  };
}

/** Signs the way Paymob documents it: the listed fields joined in order, HMAC-SHA512. */
function sign(obj: any, secret = HMAC) {
  const text = [
    obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction, obj.id,
    obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
    obj.is_voided, obj.order.id, obj.owner, obj.pending, obj.source_data.pan, obj.source_data.sub_type,
    obj.source_data.type, obj.success,
  ].join('');
  return createHmac('sha512', secret).update(text).digest('hex');
}

const callback = (obj: any, hmac = sign(obj), type = 'TRANSACTION') => ({
  body: { type, obj },
  query: { hmac },
  headers: {},
});

describe('PaymobProvider', () => {
  const paymob = new PaymobProvider();

  describe('webhook', () => {
    it('reads a signed successful payment', () => {
      expect(paymob.parseWebhook(credentials, callback(transaction()))).toEqual({
        kind: 'paid',
        reference: 'attempt-ref-1',
        transactionId: '987654',
        amountMinor: 31500,
        currencyCode: 'EGP',
      });
    });

    it('reads a signed declined payment as failed', () => {
      const event = paymob.parseWebhook(credentials, callback(transaction({ success: false })));
      expect(event).toMatchObject({ kind: 'failed', reference: 'attempt-ref-1' });
    });

    it('refuses a notice whose amount was changed after signing', () => {
      const obj = transaction();
      const forged = { ...obj, amount_cents: 100 };
      expect(() => paymob.parseWebhook(credentials, callback(forged, sign(obj)))).toThrow(UnauthorizedException);
    });

    it('refuses a notice signed with another secret, or not signed at all', () => {
      const obj = transaction();
      expect(() => paymob.parseWebhook(credentials, callback(obj, sign(obj, 'someone-else')))).toThrow(UnauthorizedException);
      expect(() => paymob.parseWebhook(credentials, { body: { type: 'TRANSACTION', obj }, query: {}, headers: {} })).toThrow(UnauthorizedException);
    });

    it('does not act on refunds, voids, or payments still in flight', () => {
      for (const override of [{ is_refunded: true }, { is_voided: true }, { pending: true }]) {
        expect(paymob.parseWebhook(credentials, callback(transaction(override)))).toEqual({ kind: 'ignored' });
      }
    });

    it('acknowledges and drops other kinds of notice', () => {
      expect(paymob.parseWebhook(credentials, callback(transaction(), undefined, 'TOKEN'))).toEqual({ kind: 'ignored' });
    });
  });

  describe('credentials', () => {
    it('names what is missing', () => {
      expect(() => paymob.assertCredentials({ ...credentials, hmacSecret: '' })).toThrow(/hmacSecret/);
    });

    it('wants integration ids as numbers', () => {
      expect(() => paymob.assertCredentials({ ...credentials, integrationIds: '12, abc' })).toThrow(BadRequestException);
    });

    it('only talks to Paymob, over https', () => {
      for (const apiBase of ['http://accept.paymob.com', 'https://evil.example.com', 'https://paymob.com.evil.com', 'https://169.254.169.254']) {
        expect(() => paymob.assertCredentials({ ...credentials, apiBase })).toThrow(BadRequestException);
      }
      expect(() => paymob.assertCredentials({ ...credentials, apiBase: 'https://ksa.paymob.com' })).not.toThrow();
      expect(() => paymob.assertCredentials(credentials)).not.toThrow();
    });
  });

  describe('inquire', () => {
    const withKey = { ...credentials, apiKey: 'api-key-1' };
    const calls: { url: string; body: any; headers: any }[] = [];
    const original = global.fetch;

    const answer = (...responses: { status?: number; json: unknown }[]) => {
      calls.length = 0;
      global.fetch = (async (url: string, init: any) => {
        calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
        const next = responses.shift()!;
        return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, text: async () => JSON.stringify(next.json) } as Response;
      }) as typeof fetch;
    };
    afterEach(() => {
      global.fetch = original;
    });

    it('trades the API key for a token, then asks by the reference we sent', async () => {
      answer({ json: { token: 'tok-1' } }, { json: transaction() });
      const event = await new PaymobProvider().inquire(withKey, 'attempt-ref-1');

      expect(calls[0].url).toBe('https://accept.paymob.com/api/auth/tokens');
      expect(calls[0].body).toEqual({ api_key: 'api-key-1' });
      expect(calls[0].headers.Authorization).toBeUndefined();
      expect(calls[1].url).toBe('https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry');
      expect(calls[1].body).toEqual({ auth_token: 'tok-1', merchant_order_id: 'attempt-ref-1' });
      expect(event).toEqual({ kind: 'paid', reference: 'attempt-ref-1', transactionId: '987654', amountMinor: 31500, currencyCode: 'EGP' });
    });

    it('says nothing is known when there is no API key, no transaction yet, or the transaction is still pending', async () => {
      const provider = new PaymobProvider();
      expect(await provider.inquire(credentials, 'x')).toEqual({ kind: 'ignored' });

      answer({ json: { token: 'tok-1' } }, { status: 404, json: { detail: 'not found' } });
      expect(await provider.inquire(withKey, 'x')).toEqual({ kind: 'ignored' });

      answer({ json: { token: 'tok-1' } }, { json: transaction({ pending: true }) });
      expect(await provider.inquire(withKey, 'x')).toEqual({ kind: 'ignored' });
    });

    it('does not treat a refund as a payment', async () => {
      answer({ json: { token: 'tok-1' } }, { json: transaction({ is_refunded: true }) });
      expect(await new PaymobProvider().inquire(withKey, 'x')).toEqual({ kind: 'ignored' });
    });
  });
});
