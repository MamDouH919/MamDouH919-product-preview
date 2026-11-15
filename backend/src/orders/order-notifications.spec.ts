import { OrderNotificationsService } from './order-notifications.service';
import { PaymentMethod } from './enums/order-status.enum';

const order = (over: Record<string, unknown> = {}) =>
  ({
    _id: 'o1',
    orderNumber: 1007,
    locale: 'en',
    paymentMethod: PaymentMethod.ONLINE,
    items: [{ name: { en: 'Tea' }, quantity: 2, lineTotal: 300 }],
    subtotal: 300,
    shippingFee: 45,
    total: 345,
    shippingAddress: { fullName: 'Mona', phone: '0100' },
    ...over,
  }) as never;

describe('OrderNotificationsService — online payment mail', () => {
  const sent: { to: string; subject: string; html: string; kind: string }[] = [];
  const mail = {
    send: async (m: { to: string; subject: string; html: string }, kind: string) => {
      sent.push({ ...m, kind });
    },
    sendToStore: async () => undefined,
  };
  const tenants = { getFrontendUrl: () => 'https://shop.test' };
  const config = { get: () => undefined };
  const service = new OrderNotificationsService(mail as never, tenants as never, config as never);
  const ctx = { host: 'api.shop.test', customerEmail: 'mona@x.test', storeName: { en: 'Shop' }, currency: { en: 'EGP' } } as never;
  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    sent.length = 0;
  });

  it('tells a customer who ordered online to expect confirmation after payment, not cash on delivery', async () => {
    service.orderPlaced(order(), ctx);
    await flush();
    expect(sent[0].html).toContain('online payment goes through');
    expect(sent[0].html).not.toContain('pay in cash');
  });

  it('still says cash on delivery for a cash order', async () => {
    service.orderPlaced(order({ paymentMethod: PaymentMethod.CASH_ON_DELIVERY }), ctx);
    await flush();
    expect(sent[0].html).toContain('pay in cash');
  });

  it('says how much was received, and how much is going back', async () => {
    service.paymentReceived(order(), ctx, 34500);
    service.paymentRefunded(order({ locale: 'ar' }), ctx, 15000);
    await flush();
    expect(sent[0].subject).toBe('Shop — Payment received for order #1007');
    expect(sent[0].html).toContain('345 EGP');
    expect(sent[0].kind).toBe('customerOrderStatus');
    expect(sent[1].html).toContain('150');
    expect(sent[1].html).toContain('dir="rtl"');
  });

  it('sends nothing without an address to send to', async () => {
    service.paymentReceived(order(), { ...(ctx as object), customerEmail: undefined } as never, 100);
    await flush();
    expect(sent).toHaveLength(0);
  });
});
