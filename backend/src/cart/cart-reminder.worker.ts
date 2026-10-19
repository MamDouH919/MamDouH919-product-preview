import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Customer } from '../customers/schemas/customer.schema';
import { Order } from '../orders/schemas/order.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { MailService } from '../mail/mail.service';
import { MailSettingsService } from '../mail/mail-settings.service';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { escapeHtml } from '../common/helpers/escape-html';
import { CartLine, CartService } from './cart.service';

type Lang = 'en' | 'ar';

/** Customers handled per store per run, so one big store can't hog a run. */
const BATCH = 50;
/** Carts left longer than this are history, not a sale to rescue — never reminded. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    subject: 'You left something in your cart',
    title: 'Still thinking it over?',
    body: 'Hi {name}, the items below are still waiting in your cart. Prices and availability can change, so complete your order while they are in stock.',
    item: 'Item',
    qty: 'Qty',
    price: 'Price',
    cta: 'Complete your order',
    optOut: "Don't want these reminders?",
    optOutLink: 'Stop cart reminders',
  },
  ar: {
    subject: 'نسيت بعض المنتجات في سلتك',
    title: 'هل ما زلت تفكر؟',
    body: 'مرحبًا {name}، المنتجات التالية ما زالت في سلتك. قد تتغير الأسعار والكميات المتوفرة، فأكمل طلبك قبل نفادها.',
    item: 'المنتج',
    qty: 'الكمية',
    price: 'السعر',
    cta: 'أكمل طلبك',
    optOut: 'لا تريد هذه التذكيرات؟',
    optOutLink: 'إيقاف تذكيرات السلة',
  },
};

/**
 * One store's pass of cart reminders. Request-scoped like the rest of the
 * tenant code: the scheduler resolves it per store with that store's host
 * standing in for a request, so models and mail settings are that store's.
 */
@Injectable()
export class CartReminderWorker {
  private readonly logger = new Logger(CartReminderWorker.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    private readonly cartService: CartService,
    private readonly mail: MailService,
    private readonly mailSettings: MailSettingsService,
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Returns how many reminders went out. */
  async run(host: string, delayMs: number): Promise<number> {
    // Cheap exit for the common case: email off, or this reminder switched off.
    const mailSettings = await this.mailSettings.getDocument();
    if (!mailSettings.enabled || !mailSettings.notifications?.customerAbandonedCart) return 0;

    const now = Date.now();
    const due: QueryFilter<Customer> = {
      isActive: true,
      isGuest: false,
      cartReminders: { $ne: false },
      'cart.items.0': { $exists: true },
      'cart.updatedAt': { $lte: new Date(now - delayMs), $gte: new Date(now - MAX_AGE_MS) },
      $or: [
        { 'cart.remindedAt': { $exists: false } },
        { $expr: { $lt: ['$cart.remindedAt', '$cart.updatedAt'] } },
      ],
    };

    const candidates = await this.customerModel
      .find(due)
      .select('+cart name email')
      .limit(BATCH)
      .exec();
    if (!candidates.length) return 0;

    const settings = await this.settingModel.findOne().select('siteTitle currency').lean().exec();
    let sent = 0;

    for (const customer of candidates) {
      const cart = customer.cart!;

      // Claim first, atomically: if two instances run at once, or the cart
      // changed since it was read, only one claim matches and only it sends.
      const claim = await this.customerModel
        .updateOne(
          // `due` first, so the exact `cart.updatedAt` below replaces its range.
          { ...due, _id: customer._id, 'cart.updatedAt': cart.updatedAt },
          { $set: { 'cart.remindedAt': new Date() } },
        )
        .exec();
      if (!claim.modifiedCount) continue;

      // Ordered since (another device, or a cart that never got cleared).
      if (await this.orderModel.exists({ customer: customer._id, createdAt: { $gte: cart.updatedAt } })) continue;

      const lines = await this.cartService.describe(cart.items);
      if (!lines.length) continue;

      const lang: Lang = cart.locale === 'en' ? 'en' : 'ar';
      try {
        await this.mail.send(
          {
            to: customer.email,
            subject: this.subject(lang, settings?.siteTitle),
            html: this.html(lang, {
              name: customer.name,
              lines,
              storeName: settings?.siteTitle,
              currency: settings?.currency,
              cartLink: `${this.frontend(host)}/${lang}/cart`,
              optOutLink: `${this.frontend(host)}/${lang}/cart-reminders?token=${encodeURIComponent(
                this.cartService.optOutToken(String(customer._id), host),
              )}`,
            }),
          },
          'customerAbandonedCart',
        );
        sent++;
      } catch (error) {
        // Not retried: the claim stands, so a mail outage can't turn into a
        // burst of duplicates once it recovers.
        this.logger.warn(`${host}: cart reminder to ${customer._id} not sent — ${(error as Error).message}`);
      }
    }

    return sent;
  }

  // ── Email ───────────────────────────────────────────────────────────────────

  private t(lang: Lang, key: string, vars: Record<string, string> = {}): string {
    return (COPY[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  private localized(field: LocalizedField | undefined, lang: Lang): string {
    return field?.[lang] || field?.ar || field?.en || '';
  }

  private subject(lang: Lang, storeName?: LocalizedField): string {
    const store = this.localized(storeName, lang);
    const text = this.t(lang, 'subject');
    return store ? `${store} — ${text}` : text;
  }

  private frontend(host: string): string {
    return (this.tenants.getFrontendUrl(host) ?? this.config.get<string>('frontendUrl') ?? '').replace(/\/+$/, '');
  }

  private html(
    lang: Lang,
    data: {
      name: string;
      lines: CartLine[];
      storeName?: LocalizedField;
      currency?: LocalizedField;
      cartLink: string;
      optOutLink: string;
    },
  ): string {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const align = dir === 'rtl' ? 'right' : 'left';
    const store = escapeHtml(this.localized(data.storeName, lang));
    const currency = this.localized(data.currency, lang);
    const cell = 'padding:8px 4px;border-bottom:1px solid #eee';
    const firstName = data.name.trim().split(/\s+/)[0] ?? '';

    const rows = data.lines
      .map((line) => {
        const name = this.localized(line.name, lang) + (line.variantLabel ? ` (${line.variantLabel})` : '');
        const price = line.price != null ? `${line.price.toLocaleString('en-US')} ${currency}`.trim() : '—';
        return `<tr><td style="${cell}">${escapeHtml(name)}</td><td style="${cell};text-align:center">${line.quantity}</td><td style="${cell};white-space:nowrap">${escapeHtml(price)}</td></tr>`;
      })
      .join('');

    const button = data.cartLink.startsWith('http')
      ? `<p style="margin:24px 0 0"><a href="${escapeHtml(data.cartLink)}" style="display:inline-block;background:#222;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${escapeHtml(this.t(lang, 'cta'))}</a></p>`
      : '';
    const optOut = data.optOutLink.startsWith('http')
      ? `<p style="margin:28px 0 0;font-size:12px;color:#888">${escapeHtml(this.t(lang, 'optOut'))} <a href="${escapeHtml(data.optOutLink)}" style="color:#888">${escapeHtml(this.t(lang, 'optOutLink'))}</a></p>`
      : '';

    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Tahoma,Arial,sans-serif;color:#222">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;direction:${dir};text-align:${align}">
    ${store ? `<p style="margin:0 0 16px;font-size:14px;color:#888">${store}</p>` : ''}
    <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(this.t(lang, 'title'))}</h2>
    <p style="margin:0 0 16px;line-height:1.6">${escapeHtml(this.t(lang, 'body', { name: firstName }))}</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;font-size:14px">
      <thead><tr>
        <th style="${cell};text-align:inherit">${escapeHtml(this.t(lang, 'item'))}</th>
        <th style="${cell}">${escapeHtml(this.t(lang, 'qty'))}</th>
        <th style="${cell};text-align:inherit">${escapeHtml(this.t(lang, 'price'))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${button}
    ${optOut}
  </div>
</body>
</html>`;
  }
}
