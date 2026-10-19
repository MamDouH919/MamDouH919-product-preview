import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { MailNotification } from '../mail/schemas/mail-setting.schema';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { escapeHtml } from '../common/helpers/escape-html';
import { Order } from '../orders/schemas/order.schema';
import { ReturnRequest, ReturnStatus } from './schemas/return-request.schema';

type Lang = 'en' | 'ar';

export interface ReturnMailContext {
  host: string;
  order: Pick<Order, '_id' | 'orderNumber' | 'locale' | 'guestToken'>;
  customerEmail?: string;
  storeName?: LocalizedField;
  currency?: LocalizedField;
}

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    requestedSubject: 'Return request #{r} received',
    requestedTitle: "We've received your return request",
    requestedBody: "We'll review return #{r} for order #{n} and let you know what happens next.",
    approvedSubject: 'Return #{r} approved',
    approvedTitle: 'Your return was approved',
    approvedBody: 'Return #{r} for order #{n} was approved. We will be in touch about collecting the items.',
    rejectedSubject: 'Return #{r} declined',
    rejectedTitle: "We couldn't accept your return",
    rejectedBody: 'Return #{r} for order #{n} was declined.',
    refundedSubject: 'Refund for return #{r}',
    refundedTitle: 'Your refund has been issued',
    refundedBody: 'We refunded {amount} for return #{r} on order #{n}.',
    alertSubject: 'Return request #{r} for order #{n}',
    alertTitle: 'New return request #{r}',
    alertBody: 'The customer asked to return items from order #{n}.',
    item: 'Item',
    qty: 'Qty',
    note: 'Note',
    reason: 'Reason',
    viewOrder: 'View your order',
    openInDashboard: 'Open in dashboard',
    reason_damaged: 'Arrived damaged',
    reason_wrong_item: 'Wrong item',
    reason_not_as_described: 'Not as described',
    reason_changed_mind: 'Changed my mind',
    reason_other: 'Other',
  },
  ar: {
    requestedSubject: 'تم استلام طلب الإرجاع رقم #{r}',
    requestedTitle: 'استلمنا طلب الإرجاع',
    requestedBody: 'سنراجع طلب الإرجاع رقم #{r} للطلب رقم #{n} ونبلغك بالخطوة التالية.',
    approvedSubject: 'تمت الموافقة على الإرجاع رقم #{r}',
    approvedTitle: 'تمت الموافقة على طلب الإرجاع',
    approvedBody: 'تمت الموافقة على الإرجاع رقم #{r} للطلب رقم #{n}. سنتواصل معك لاستلام المنتجات.',
    rejectedSubject: 'تم رفض الإرجاع رقم #{r}',
    rejectedTitle: 'لم نتمكن من قبول طلب الإرجاع',
    rejectedBody: 'تم رفض طلب الإرجاع رقم #{r} للطلب رقم #{n}.',
    refundedSubject: 'استرداد المبلغ للإرجاع رقم #{r}',
    refundedTitle: 'تم رد المبلغ',
    refundedBody: 'تم رد {amount} عن الإرجاع رقم #{r} للطلب رقم #{n}.',
    alertSubject: 'طلب إرجاع رقم #{r} للطلب رقم #{n}',
    alertTitle: 'طلب إرجاع جديد رقم #{r}',
    alertBody: 'طلب العميل إرجاع منتجات من الطلب رقم #{n}.',
    item: 'المنتج',
    qty: 'الكمية',
    note: 'ملاحظة',
    reason: 'السبب',
    viewOrder: 'عرض طلبك',
    openInDashboard: 'فتح في لوحة التحكم',
    reason_damaged: 'وصل تالفًا',
    reason_wrong_item: 'منتج خاطئ',
    reason_not_as_described: 'غير مطابق للوصف',
    reason_changed_mind: 'غيرت رأيي',
    reason_other: 'سبب آخر',
  },
};

/** Return emails. Fire-and-forget like order emails: a mail outage never fails a return. */
@Injectable()
export class ReturnNotificationsService {
  private readonly logger = new Logger(ReturnNotificationsService.name);

  constructor(
    private readonly mail: MailService,
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Tells the customer where their return stands; tells the store when a customer opens one. */
  statusChanged(ret: ReturnRequest, ctx: ReturnMailContext, note?: string): void {
    const lang: Lang = ctx.order.locale === 'en' ? 'en' : 'ar';
    const vars = {
      r: String(ret.returnNumber),
      n: String(ctx.order.orderNumber),
      amount: this.money(ret.refundAmount ?? 0, lang, ctx),
    };
    const key = ret.status;

    if (ctx.customerEmail) {
      this.send(ret, 'customerOrderStatus', {
        to: ctx.customerEmail,
        subject: this.subject(lang, `${key}Subject`, vars, ctx),
        html: this.layout(lang, ctx, [
          this.heading(this.t(lang, `${key}Title`)),
          this.paragraph(this.t(lang, `${key}Body`, vars)),
          note && key !== ReturnStatus.REQUESTED ? this.labelled(this.t(lang, 'note'), note) : '',
          this.itemsTable(ret, lang),
          this.button(this.customerLink(ctx, lang), this.t(lang, 'viewOrder')),
        ]),
      });
    }

    if (key === ReturnStatus.REQUESTED && ret.openedBy === 'customer') {
      this.send(ret, 'storeReturnRequest', {
        replyTo: ctx.customerEmail,
        subject: this.t(lang, 'alertSubject', vars),
        html: this.layout(lang, ctx, [
          this.heading(this.t(lang, 'alertTitle', vars)),
          this.paragraph(this.t(lang, 'alertBody', vars)),
          this.labelled(this.t(lang, 'reason'), this.t(lang, `reason_${ret.reason}`)),
          ret.note ? this.labelled(this.t(lang, 'note'), ret.note) : '',
          this.itemsTable(ret, lang),
          this.button(`${this.frontend(ctx.host)}/${lang}/admin/returns/${ret._id}`, this.t(lang, 'openInDashboard')),
        ]),
      });
    }
  }

  private send(
    ret: ReturnRequest,
    kind: MailNotification,
    message: { to?: string; subject: string; html: string; replyTo?: string },
  ): void {
    const { to, ...rest } = message;
    const sending = to ? this.mail.send({ ...rest, to }, kind) : this.mail.sendToStore(rest, kind);
    sending.catch((error: Error) =>
      this.logger.warn(`Return #${ret.returnNumber}: email "${message.subject}" not sent — ${error.message}`),
    );
  }

  private t(lang: Lang, key: string, vars: Record<string, string> = {}): string {
    return (COPY[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  private localized(field: LocalizedField | undefined, lang: Lang): string {
    return field?.[lang] || field?.ar || field?.en || '';
  }

  private subject(lang: Lang, key: string, vars: Record<string, string>, ctx: ReturnMailContext): string {
    const store = this.localized(ctx.storeName, lang);
    const text = this.t(lang, key, vars);
    return store ? `${store} — ${text}` : text;
  }

  private money(amount: number, lang: Lang, ctx: ReturnMailContext): string {
    return `${amount.toLocaleString('en-US')} ${this.localized(ctx.currency, lang)}`.trim();
  }

  private frontend(host: string): string {
    return (this.tenants.getFrontendUrl(host) ?? this.config.get<string>('frontendUrl') ?? '').replace(/\/+$/, '');
  }

  private customerLink(ctx: ReturnMailContext, lang: Lang): string {
    const base = this.frontend(ctx.host);
    return ctx.order.guestToken
      ? `${base}/${lang}/orders/${ctx.order._id}?token=${ctx.order.guestToken}`
      : `${base}/${lang}/account/orders/${ctx.order._id}`;
  }

  private layout(lang: Lang, ctx: ReturnMailContext, blocks: string[]): string {
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

  private itemsTable(ret: ReturnRequest, lang: Lang): string {
    const cell = 'padding:8px 4px;border-bottom:1px solid #eee';
    const rows = ret.items
      .map((item) => {
        const name = this.localized(item.name, lang) + (item.variantLabel ? ` (${item.variantLabel})` : '');
        return `<tr><td style="${cell}">${escapeHtml(name)}</td><td style="${cell};text-align:center">${item.quantity}</td></tr>`;
      })
      .join('');
    return `<table style="width:100%;border-collapse:collapse;margin:8px 0 20px;font-size:14px">
  <thead><tr><th style="${cell};text-align:inherit">${escapeHtml(this.t(lang, 'item'))}</th><th style="${cell}">${escapeHtml(this.t(lang, 'qty'))}</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }
}
