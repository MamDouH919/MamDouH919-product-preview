/**
 * What the system writes on the entries it posts, in both of the dashboard's
 * languages. An entry stores the key and its values, not the sentence, so it
 * reads in whichever language it is opened in. The English text is stored
 * too, for searching the journal.
 */

export type MemoParams = Record<string, string | number>;
export type LocalText = { en: string; ar: string; es: string };

/** Stock movement kinds, as the Arabic memo names them. English keeps the raw kind. */
const MOVEMENT_AR: Record<string, string> = {
  opening: 'رصيد افتتاحي',
  purchase: 'شراء',
  sale: 'بيع',
  return: 'مرتجع',
  damage: 'تالف',
  order_cancelled: 'طلب ملغي',
  adjustment_in: 'تسوية بالإضافة',
  adjustment_out: 'تسوية بالخصم',
  purchase_return: 'مرتجع للمورد',
  cost_set: 'تحديد التكلفة',
};

const MOVEMENT_ES: Record<string, string> = {
  opening: 'saldo inicial',
  purchase: 'compra',
  sale: 'venta',
  return: 'devolución',
  damage: 'daño',
  order_cancelled: 'pedido cancelado',
  adjustment_in: 'ajuste (añadir)',
  adjustment_out: 'ajuste (retirar)',
  purchase_return: 'devolución al proveedor',
  cost_set: 'coste definido',
};

const withReason = (text: string, reason: unknown) => (reason ? `${text}: ${reason}` : text);

const TEMPLATES = {
  opening_stock: {
    en: (p) => `Opening stock value, ${p.qty} unit(s)`,
    ar: (p) => `قيمة مخزون أول المدة، ${p.qty} وحدة`,
  },
  opening_cost_corrected: {
    en: (p) => `Opening cost corrected, ${p.qty} unit(s)`,
    ar: (p) => `تصحيح تكلفة مخزون أول المدة، ${p.qty} وحدة`,
  },
  stock_movement: {
    en: (p) => withReason(`Stock ${String(p.type).replace('_', ' ')}`, p.reason),
    ar: (p) => withReason(`حركة مخزون: ${MOVEMENT_AR[String(p.type)] ?? p.type}`, p.reason),
  },
  purchase: {
    en: (p) => `Purchase #${p.number}`,
    ar: (p) => `فاتورة مشتريات #${p.number}`,
  },
  purchase_return: {
    en: (p) => `Goods back to supplier, purchase #${p.number}`,
    ar: (p) => `مرتجع للمورد، فاتورة مشتريات #${p.number}`,
  },
  supplier_payment: {
    en: (p) => `Payment to ${p.supplier}`,
    ar: (p) => `دفعة للمورد ${p.supplier}`,
  },
  courier_settled: {
    en: (p) => `${p.courier} settled`,
    ar: (p) => `تسوية حساب المندوب ${p.courier}`,
  },
  collection: {
    en: (p) => `Collection #${p.payment} for order #${p.order}`,
    ar: (p) => `تحصيل #${p.payment} للطلب #${p.order}`,
  },
  online_payment: {
    en: (p) => `Online payment #${p.payment} for order #${p.order}`,
    ar: (p) => `دفع أونلاين #${p.payment} للطلب #${p.order}`,
  },
  online_payment_applied: {
    en: (p) => `Online payment #${p.payment} applied to delivered order #${p.order}`,
    ar: (p) => `تطبيق الدفع الأونلاين #${p.payment} على الطلب المُسلَّم #${p.order}`,
  },
  online_payment_refunded: {
    en: (p) => `Online payment #${p.payment} refunded for cancelled order #${p.order}`,
    ar: (p) => `رد الدفع الأونلاين #${p.payment} للطلب الملغي #${p.order}`,
  },
  gateway_payout: {
    en: (p) => `Payment gateway payout #${p.payout}`,
    ar: (p) => `تحويل من بوابة الدفع #${p.payout}`,
  },
  write_off: {
    en: (p) => `Order #${p.order} written off: ${p.reason}`,
    ar: (p) => `إعدام مديونية الطلب #${p.order}: ${p.reason}`,
  },
  refund: {
    en: (p) => `Refund #${p.refund} for order #${p.order}`,
    ar: (p) => `استرداد #${p.refund} للطلب #${p.order}`,
  },
  order_placed: {
    en: (p) => `Order #${p.order} placed — goods set aside at cost`,
    ar: (p) => `تم إنشاء الطلب #${p.order} — حجز البضاعة بالتكلفة`,
  },
  order_delivered: {
    en: (p) => `Order #${p.order} delivered`,
    ar: (p) => `تم تسليم الطلب #${p.order}`,
  },
  order_cancelled: {
    en: (p) => `Order #${p.order} cancelled — stock back on the shelf`,
    ar: (p) => `تم إلغاء الطلب #${p.order} — رجوع البضاعة للمخزون`,
  },
  transfer: {
    en: () => 'Transfer between accounts',
    ar: () => 'تحويل بين الحسابات',
  },
  opening_balance: {
    en: () => 'Opening balance',
    ar: () => 'رصيد افتتاحي',
  },
  reversal: {
    en: (p) => withReason(`Reverses entry #${p.entry}`, p.reason),
    ar: (p) => withReason(`عكس القيد #${p.entry}`, p.reason),
  },
} satisfies Record<string, { en: (p: MemoParams) => string; ar: (p: MemoParams) => string }>;

/** The same sentences in Spanish. */
const TEMPLATES_ES: Record<keyof typeof TEMPLATES, (p: MemoParams) => string> = {
  opening_stock: (p) => `Valor del stock inicial, ${p.qty} unidad(es)`,
  opening_cost_corrected: (p) => `Coste inicial corregido, ${p.qty} unidad(es)`,
  stock_movement: (p) => withReason(`Movimiento de stock: ${MOVEMENT_ES[String(p.type)] ?? p.type}`, p.reason),
  purchase: (p) => `Compra n.º ${p.number}`,
  purchase_return: (p) => `Mercancía devuelta al proveedor, compra n.º ${p.number}`,
  supplier_payment: (p) => `Pago a ${p.supplier}`,
  courier_settled: (p) => `Liquidación con ${p.courier}`,
  collection: (p) => `Cobro n.º ${p.payment} del pedido n.º ${p.order}`,
  online_payment: (p) => `Pago en línea n.º ${p.payment} del pedido n.º ${p.order}`,
  online_payment_applied: (p) => `Pago en línea n.º ${p.payment} aplicado al pedido entregado n.º ${p.order}`,
  online_payment_refunded: (p) => `Pago en línea n.º ${p.payment} reembolsado por el pedido cancelado n.º ${p.order}`,
  gateway_payout: (p) => `Transferencia de la pasarela de pago n.º ${p.payout}`,
  write_off: (p) => `Pedido n.º ${p.order} dado de baja: ${p.reason}`,
  refund: (p) => `Reembolso n.º ${p.refund} del pedido n.º ${p.order}`,
  order_placed: (p) => `Pedido n.º ${p.order} realizado: mercancía reservada al coste`,
  order_delivered: (p) => `Pedido n.º ${p.order} entregado`,
  order_cancelled: (p) => `Pedido n.º ${p.order} cancelado: el stock vuelve a la estantería`,
  transfer: () => 'Transferencia entre cuentas',
  opening_balance: () => 'Saldo inicial',
  reversal: (p) => withReason(`Revierte el asiento n.º ${p.entry}`, p.reason),
};

export type MemoKey = keyof typeof TEMPLATES;

/** A system memo: which sentence, and the values that go in it. */
export interface JournalMemo {
  key: MemoKey;
  params?: MemoParams;
}

export const memo = (key: MemoKey, params: MemoParams = {}): JournalMemo => ({ key, params });

/**
 * An entry's memo in both languages. Entries typed by staff, and those posted
 * before memos had keys, carry only their stored text, shown as it is.
 */
export function memoText(e: { memo?: string; memoKey?: string; memoParams?: MemoParams }): LocalText | undefined {
  const template = e.memoKey ? TEMPLATES[e.memoKey as MemoKey] : undefined;
  if (template) {
    const params = e.memoParams ?? {};
    return { en: template.en(params), ar: template.ar(params), es: TEMPLATES_ES[e.memoKey as MemoKey](params) };
  }
  return e.memo ? { en: e.memo, ar: e.memo, es: e.memo } : undefined;
}
