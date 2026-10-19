import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService, OutgoingMail } from '../mail/mail.service';
import { MailNotification } from '../mail/schemas/mail-setting.schema';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { escapeHtml } from '../common/helpers/escape-html';
import { Order } from './schemas/order.schema';
import { OrderStatus } from './enums/order-status.enum';

type Lang = 'en' | 'ar';

/** What a message needs beyond the order itself. */
export interface NotificationContext {
  /** Request host — picks the tenant's frontend for links. */
  host: string;
  customerEmail?: string;
  storeName?: LocalizedField;
  currency?: LocalizedField;
  /** For a guest: where they set a password and turn the record into an account. */
  activationLink?: string;
}

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    placedSubject: 'Order #{n} received',
    placedTitle: 'Thanks for your order!',
    placedBody: "We've received order #{n} and will confirm it shortly. You'll pay in cash when it arrives.",
    confirmedSubject: 'Order #{n} confirmed',
    confirmedTitle: 'Your order is confirmed',
    confirmedBody: "We're preparing order #{n} now.",
    shippedSubject: 'Order #{n} is on its way',
    shippedTitle: 'Your order is on its way',
    shippedBody: 'Order #{n} has been handed to delivery.',
    deliveredSubject: 'Order #{n} delivered',
    deliveredTitle: 'Your order was delivered',
    deliveredBody: 'Order #{n} has been delivered. Thank you for shopping with us!',
    cancelledSubject: 'Order #{n} cancelled',
    cancelledTitle: 'Your order was cancelled',
    cancelledBody: 'Order #{n} has been cancelled.',
    alertSubject: 'New order #{n} — {total}',
    alertTitle: 'New order #{n}',
    alertCancelledSubject: 'Order #{n} cancelled by the customer',
    alertCancelledTitle: 'Order #{n} was cancelled by the customer',
    item: 'Item',
    qty: 'Qty',
    lineTotal: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    delivery: 'Delivery',
    free: 'Free',
    total: 'Total',
    address: 'Delivery address',
    notes: 'Customer notes',
    note: 'Note',
    viewOrder: 'View your order',
    openInDashboard: 'Open in dashboard',
    activateTitle: 'Save your details for next time',
    activateBody: 'Create an account to track this order and check out faster.',
    activate: 'Create account',
  },
  ar: {
    placedSubject: 'تم استلام الطلب رقم #{n}',
    placedTitle: 'شكرًا لطلبك!',
    placedBody: 'استلمنا الطلب رقم #{n} وسنؤكده قريبًا. الدفع نقدًا عند الاستلام.',
    confirmedSubject: 'تم تأكيد الطلب رقم #{n}',
    confirmedTitle: 'تم تأكيد طلبك',
    confirmedBody: 'نقوم الآن بتجهيز الطلب رقم #{n}.',
    shippedSubject: 'الطلب رقم #{n} في الطريق إليك',
    shippedTitle: 'طلبك في الطريق إليك',
    shippedBody: 'تم تسليم الطلب رقم #{n} لشركة التوصيل.',
    deliveredSubject: 'تم توصيل الطلب رقم #{n}',
    deliveredTitle: 'تم توصيل طلبك',
    deliveredBody: 'تم توصيل الطلب رقم #{n}. شكرًا لتسوقك معنا!',
    cancelledSubject: 'تم إلغاء الطلب رقم #{n}',
    cancelledTitle: 'تم إلغاء طلبك',
    cancelledBody: 'تم إلغاء الطلب رقم #{n}.',
    alertSubject: 'طلب جديد رقم #{n} — {total}',
    alertTitle: 'طلب جديد رقم #{n}',
    alertCancelledSubject: 'ألغى العميل الطلب رقم #{n}',
    alertCancelledTitle: 'ألغى العميل الطلب رقم #{n}',
    item: 'المنتج',
    qty: 'الكمية',
    lineTotal: 'الإجمالي',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    delivery: 'التوصيل',
    free: 'مجاني',
    total: 'الإجمالي',
    address: 'عنوان التوصيل',
    notes: 'ملاحظات العميل',
    note: 'ملاحظة',
    viewOrder: 'عرض طلبك',
    openInDashboard: 'فتح في لوحة التحكم',
    activateTitle: 'احفظ بياناتك للمرة القادمة',
    activateBody: 'أنشئ حسابًا لمتابعة هذا الطلب وإتمام الشراء بشكل أسرع.',
    activate: 'إنشاء حساب',
  },
};

/**
 * Order emails. Every send is fire-and-forget: a mail outage must never fail
 * or slow down checkout or a status change, so failures are logged and dropped.
 * Store alerts go to the recipients set in Settings → Email, and each kind of
 * email can be switched off there.
 */
@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);

  constructor(
    private readonly mail: MailService,
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Confirmation to the customer, alert to the store. */
  orderPlaced(order: Order, ctx: NotificationContext): void {
    const lang = this.lang(order);
    const n = String(order.orderNumber);

    if (ctx.customerEmail) {
      this.dispatch(order, 'customerOrderPlaced', {
        to: ctx.customerEmail,
        subject: this.subject(lang, 'placedSubject', n, ctx),
        html: this.layout(lang, ctx, [
          this.heading(this.t(lang, 'placedTitle', { n })),
          this.paragraph(this.t(lang, 'placedBody', { n })),
          this.itemsTable(order, lang, ctx),
          this.addressBlock(order, lang),
          this.button(this.customerLink(order, ctx.host), this.t(lang, 'viewOrder')),
          ctx.activationLink ? '<hr style="border:none;border-top:1px solid #eee;margin:28px 0 20px">' : '',
          ctx.activationLink ? this.heading(this.t(lang, 'activateTitle')) : '',
          ctx.activationLink ? this.paragraph(this.t(lang, 'activateBody')) : '',
          ctx.activationLink ? this.button(ctx.activationLink, this.t(lang, 'activate')) : '',
        ]),
      });
    }

    const total = this.money(order.total, lang, ctx);
    this.dispatch(order, 'storeNewOrder', {
      replyTo: ctx.customerEmail,
      subject: this.t(lang, 'alertSubject', { n, total }),
      html: this.layout(lang, ctx, [
        this.heading(this.t(lang, 'alertTitle', { n })),
        this.itemsTable(order, lang, ctx),
        this.addressBlock(order, lang),
        order.notes ? this.labelled(this.t(lang, 'notes'), order.notes) : '',
        this.button(this.adminLink(order, ctx.host), this.t(lang, 'openInDashboard')),
      ]),
    });
  }

  /** Tells the customer their order moved; tells the store if the customer cancelled. */
  statusChanged(
    order: Order,
    ctx: NotificationContext,
    change: { note?: string; byCustomer?: boolean },
  ): void {
    const lang = this.lang(order);
    const n = String(order.orderNumber);
    const status = order.status;
    if (status === OrderStatus.PENDING) return;

    if (ctx.customerEmail) {
      this.dispatch(order, 'customerOrderStatus', {
        to: ctx.customerEmail,
        subject: this.subject(lang, `${status}Subject`, n, ctx),
        html: this.layout(lang, ctx, [
          this.heading(this.t(lang, `${status}Title`)),
          this.paragraph(this.t(lang, `${status}Body`, { n })),
          // A customer's own cancellation reason isn't worth echoing back.
          change.note && !change.byCustomer ? this.labelled(this.t(lang, 'note'), change.note) : '',
          this.itemsTable(order, lang, ctx),
          this.button(this.customerLink(order, ctx.host), this.t(lang, 'viewOrder')),
        ]),
      });
    }

    if (change.byCustomer && status === OrderStatus.CANCELLED) {
      this.dispatch(order, 'storeOrderCancelled', {
        subject: this.t(lang, 'alertCancelledSubject', { n }),
        html: this.layout(lang, ctx, [
          this.heading(this.t(lang, 'alertCancelledTitle', { n })),
          change.note ? this.labelled(this.t(lang, 'note'), change.note) : '',
          this.button(this.adminLink(order, ctx.host), this.t(lang, 'openInDashboard')),
        ]),
      });
    }
  }

  // ── Delivery ────────────────────────────────────────────────────────────────

  /** A message without `to` is a store alert. */
  private dispatch(
    order: Order,
    kind: MailNotification,
    message: Omit<OutgoingMail, 'to'> & { to?: string },
  ): void {
    const { to, ...rest } = message;
    const sending = to
      ? this.mail.send({ ...rest, to }, kind)
      : this.mail.sendToStore(rest, kind);
    sending.catch((error: Error) =>
      this.logger.warn(
        `Order #${order.orderNumber}: email "${message.subject}" not sent — ${error.message}`,
      ),
    );
  }

  // ── Building blocks ─────────────────────────────────────────────────────────

  private lang(order: Order): Lang {
    return order.locale === 'en' ? 'en' : 'ar';
  }

  private t(lang: Lang, key: string, vars: Record<string, string> = {}): string {
    return (COPY[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  /** Subjects are prefixed with the store name, so the inbox shows who it's from. */
  private subject(lang: Lang, key: string, n: string, ctx: NotificationContext): string {
    const store = this.localized(ctx.storeName, lang);
    const text = this.t(lang, key, { n });
    return store ? `${store} — ${text}` : text;
  }

  private localized(field: LocalizedField | undefined, lang: Lang): string {
    return field?.[lang] || field?.ar || field?.en || '';
  }

  private money(amount: number, lang: Lang, ctx: NotificationContext): string {
    const currency = this.localized(ctx.currency, lang);
    // Western digits in both languages — matching quantities and the storefront.
    return `${amount.toLocaleString('en-US')} ${currency}`.trim();
  }

  private frontend(host: string): string {
    return (
      this.tenants.getFrontendUrl(host) ?? this.config.get<string>('frontendUrl') ?? ''
    ).replace(/\/+$/, '');
  }

  private customerLink(order: Order, host: string): string {
    // A guest order opens by its token, so the link works without signing in.
    if (order.guestToken) {
      return `${this.frontend(host)}/${this.lang(order)}/orders/${order._id}?token=${order.guestToken}`;
    }
    return `${this.frontend(host)}/${this.lang(order)}/account/orders/${order._id}`;
  }

  private adminLink(order: Order, host: string): string {
    return `${this.frontend(host)}/${this.lang(order)}/admin/orders/${order._id}`;
  }

  private layout(lang: Lang, ctx: NotificationContext, blocks: string[]): string {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const store = escapeHtml(this.localized(ctx.storeName, lang));
    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Tahoma,Arial,sans-serif;color:#222">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;direction:${dir};text-align:${dir === 'rtl' ? 'right' : 'left'}">
    ${store ? `<p style="margin:0 0 16px;font-size:14px;color:#888">${store}</p>` : ''}
    ${blocks.filter(Boolean).join('\n')}
  </div>
</body>
</html>`;
  }

  private heading(text: string): string {
    return `<h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(text)}</h2>`;
  }

  private paragraph(text: string): string {
    return `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(text)}</p>`;
  }

  private labelled(label: string, text: string): string {
    return `<p style="margin:0 0 16px;line-height:1.6"><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }

  private button(href: string, label: string): string {
    if (!href.startsWith('http')) return '';
    return `<p style="margin:24px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#222;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${escapeHtml(label)}</a></p>`;
  }

  private itemsTable(order: Order, lang: Lang, ctx: NotificationContext): string {
    const cell = 'padding:8px 4px;border-bottom:1px solid #eee';
    const rows = order.items
      .map((item) => {
        const name = this.localized(item.name, lang) + (item.variantLabel ? ` (${item.variantLabel})` : '');
        return `<tr><td style="${cell}">${escapeHtml(name)}</td><td style="${cell};text-align:center">${item.quantity}</td><td style="${cell};white-space:nowrap">${escapeHtml(this.money(item.lineTotal, lang, ctx))}</td></tr>`;
      })
      .join('');

    const discount = order.discount ?? 0;
    const totals: [string, string, boolean?][] = [
      [this.t(lang, 'subtotal'), this.money(order.subtotal, lang, ctx)],
      ...(discount > 0
        ? [[
            `${this.t(lang, 'discount')}${order.coupon?.code ? ` (${order.coupon.code})` : ''}`,
            `− ${this.money(discount, lang, ctx)}`,
          ] as [string, string]]
        : []),
      [
        this.t(lang, 'delivery'),
        order.shippingFee > 0 ? this.money(order.shippingFee, lang, ctx) : this.t(lang, 'free'),
      ],
      [this.t(lang, 'total'), this.money(order.total, lang, ctx), true],
    ];

    const totalRows = totals
      .map(
        ([label, value, strong]) =>
          `<tr><td colspan="2" style="padding:4px;${strong ? 'font-weight:bold' : 'color:#666'}">${escapeHtml(label)}</td><td style="padding:4px;white-space:nowrap;${strong ? 'font-weight:bold' : ''}">${escapeHtml(value)}</td></tr>`,
      )
      .join('');

    return `<table style="width:100%;border-collapse:collapse;margin:8px 0 20px;font-size:14px">
  <thead><tr>
    <th style="${cell};text-align:inherit">${escapeHtml(this.t(lang, 'item'))}</th>
    <th style="${cell}">${escapeHtml(this.t(lang, 'qty'))}</th>
    <th style="${cell};text-align:inherit">${escapeHtml(this.t(lang, 'lineTotal'))}</th>
  </tr></thead>
  <tbody>${rows}${totalRows}</tbody>
</table>`;
  }

  private addressBlock(order: Order, lang: Lang): string {
    const a = order.shippingAddress;
    const lines = [
      a.fullName,
      a.phone,
      [
        a.street,
        a.building,
        a.area,
        this.localized(a.subZoneName, lang),
        this.localized(a.zoneName, lang) || a.city,
      ]
        .filter(Boolean)
        .join(', '),
      a.notes,
    ].filter(Boolean);
    return `<p style="margin:0 0 16px;line-height:1.6"><strong>${escapeHtml(this.t(lang, 'address'))}:</strong><br>${lines.map(escapeHtml).join('<br>')}</p>`;
  }
}
