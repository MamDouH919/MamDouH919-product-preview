import { PageBlockType, PageWidth } from './schemas/page.schema';
import { DeliveryFeeRefundPolicy } from '../settings/schemas/setting.schema';

/**
 * Ready-made shipping and returns policy pages, written from the store's own
 * settings so the numbers on them (return window, delivery fee) are the ones
 * the store actually applies. Seeded with `npm run seed:policies`; after that
 * they are ordinary pages the store edits in the dashboard.
 *
 * Google Merchant Center asks for both pages, and the storefront links them
 * from the footer, product pages and checkout.
 */

export const SHIPPING_POLICY_SLUG = 'shipping-policy';
export const RETURN_POLICY_SLUG = 'return-policy';

type Localized = { ar: string; en: string; es: string };
type Lang = 'ar' | 'en' | 'es';

export type PolicyInput = {
  /** The store's name in each language; empty falls back to "our store". */
  storeName?: Partial<Localized>;
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  country?: string;
  /** How prices are written to shoppers ("ج.م" / "EGP"). */
  currency?: Partial<Localized>;
  /** One fee for the whole country; null/undefined means it depends on the area. */
  flatDeliveryPrice?: number | null;
  returnWindowDays?: number;
  deliveryFeeRefund?: DeliveryFeeRefundPolicy;
  phone?: string;
  whatsapp?: string;
  email?: string;
  /** The store takes orders online (tracking, accounts, return requests). */
  sellsOnline: boolean;
};

const COUNTRIES: Record<string, Localized> = {
  EG: { ar: 'مصر', en: 'Egypt', es: 'Egipto' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia', es: 'Arabia Saudita' },
  AE: { ar: 'الإمارات', en: 'the UAE', es: 'los Emiratos Árabes Unidos' },
  KW: { ar: 'الكويت', en: 'Kuwait', es: 'Kuwait' },
  QA: { ar: 'قطر', en: 'Qatar', es: 'Catar' },
  BH: { ar: 'البحرين', en: 'Bahrain', es: 'Baréin' },
  OM: { ar: 'عُمان', en: 'Oman', es: 'Omán' },
  JO: { ar: 'الأردن', en: 'Jordan', es: 'Jordania' },
};

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Every way to reach the store that it has set, as one sentence fragment. */
function contactLine(input: PolicyInput, lang: Lang): string {
  const pick = <T,>(ar: T, en: T, es: T) => (lang === 'ar' ? ar : lang === 'es' ? es : en);
  const parts: string[] = [];
  if (input.whatsapp) parts.push(pick(`واتساب ${esc(input.whatsapp)}`, `WhatsApp ${esc(input.whatsapp)}`, `WhatsApp ${esc(input.whatsapp)}`));
  if (input.phone && input.phone !== input.whatsapp)
    parts.push(pick(`تليفون ${esc(input.phone)}`, `phone ${esc(input.phone)}`, `teléfono ${esc(input.phone)}`));
  if (input.email) parts.push(pick(`إيميل ${esc(input.email)}`, `email ${esc(input.email)}`, `correo electrónico ${esc(input.email)}`));
  const contactPage = `<a href="/${lang}/contact">${pick('صفحة تواصل معنا', 'our contact page', 'nuestra página de contacto')}</a>`;
  if (!parts.length) return contactPage;
  return pick(`${parts.join(' أو ')}، أو من ${contactPage}`, `${parts.join(', ')}, or through ${contactPage}`, `${parts.join(', ')} o a través de ${contactPage}`);
}

function money(amount: number, input: PolicyInput, lang: Lang): string {
  const label = input.currency?.[lang] || input.currency?.ar || input.currency?.en || input.currency?.es || '';
  return `${amount.toLocaleString('en')} ${esc(label)}`.trim();
}

let blockCounter = 0;
const block = (type: PageBlockType, data: Record<string, unknown>) => ({
  id: `policy-${type}-${++blockCounter}`,
  type,
  visible: true,
  style: {},
  data,
});

function shippingPage(input: PolicyInput) {
  const country = COUNTRIES[input.country?.toUpperCase() ?? ''];
  const where = { ar: country?.ar ?? 'كل المحافظات', en: country?.en ?? 'every governorate we serve', es: country?.es ?? 'todas las provincias a las que enviamos' };
  const flat = input.flatDeliveryPrice != null;

  const htmlEs = () => {
    const fee = flat
      ? `<p>El envío cuesta <strong>${money(input.flatDeliveryPrice!, input, 'es')}</strong> a cualquier punto de ${where.es}.</p>`
      : '<p>El coste de envío depende de tu zona, y al finalizar la compra verás el importe exacto antes de confirmar.</p>';
    const tracking = input.sellsOnline
      ? '<h2>Seguimiento de tu pedido</h2><p>Sigue tu pedido en cualquier momento en la página de <a href="/es/track">seguimiento de pedidos</a> o en Mis pedidos de tu cuenta.</p>'
      : '';
    return [
      '<h2>Dónde entregamos</h2>',
      `<p>Entregamos en la puerta de tu casa en ${where.es}.</p>`,
      '<h2>Coste de envío</h2>',
      fee,
      '<h2>Plazos de preparación y entrega</h2>',
      '<p>Preparamos tu pedido en <strong>1–2 días laborables</strong> y normalmente llega en <strong>2–5 días laborables</strong>, según tu zona.</p>',
      '<p>Los artículos hechos especialmente para ti (con un nombre o un diseño personalizado) pueden tardar más; te indicamos el plazo antes de confirmar el pedido.</p>',
      tracking,
      '<h2>Si tu pedido se retrasa o llega con algún problema</h2>',
      `<p>Contáctanos por ${contactLine(input, 'es')} y lo resolveremos cuanto antes.</p>`,
    ].join('');
  };

  const html = (lang: 'ar' | 'en') => {
    const ar = lang === 'ar';
    const fee = flat
      ? ar
        ? `<p>مصاريف التوصيل <strong>${money(input.flatDeliveryPrice!, input, lang)}</strong> لأي مكان داخل ${where.ar}.</p>`
        : `<p>Delivery costs <strong>${money(input.flatDeliveryPrice!, input, lang)}</strong> anywhere in ${where.en}.</p>`
      : ar
        ? '<p>مصاريف التوصيل بتختلف حسب المحافظة والمنطقة، وبتظهر لك بالظبط في صفحة إتمام الطلب قبل ما تأكده.</p>'
        : "<p>The delivery fee depends on your area, and checkout shows you the exact amount before you confirm.</p>";
    const tracking = input.sellsOnline
      ? ar
        ? `<h2>تتبّع الطلب</h2><p>تقدر تتابع حالة طلبك في أي وقت من صفحة <a href="/ar/track">تتبّع الطلب</a> أو من حسابك ← طلباتي.</p>`
        : `<h2>Tracking your order</h2><p>Follow your order at any time on the <a href="/en/track">order tracking</a> page or under My orders in your account.</p>`
      : '';

    return ar
      ? [
          '<h2>أماكن التوصيل</h2>',
          `<p>بنوصّل الطلبات لحد باب البيت في ${where.ar}.</p>`,
          '<h2>مصاريف التوصيل</h2>',
          fee,
          '<h2>مدة التجهيز والتوصيل</h2>',
          '<p>بنجهّز طلبك خلال <strong>1 إلى 2 يوم عمل</strong>، وبيوصل عادةً خلال <strong>2 إلى 5 أيام عمل</strong> حسب منطقتك.</p>',
          '<p>المنتجات اللي بتتعمل مخصوص ليك (بالاسم أو بتصميم خاص) ممكن تاخد وقت أطول، وبنقولك المدة قبل ما نأكد الطلب.</p>',
          tracking,
          '<h2>لو الطلب اتأخر أو وصل فيه مشكلة</h2>',
          `<p>كلمنا على ${contactLine(input, 'ar')} وهنحلها معاك في أسرع وقت.</p>`,
        ].join('')
      : [
          '<h2>Where we deliver</h2>',
          `<p>We deliver to your door anywhere in ${where.en}.</p>`,
          '<h2>Delivery fee</h2>',
          fee,
          '<h2>Processing and delivery time</h2>',
          '<p>We prepare your order within <strong>1–2 business days</strong>, and it usually arrives within <strong>2–5 business days</strong> depending on your area.</p>',
          '<p>Items made especially for you (with a name or a custom design) can take longer; we tell you how long before confirming the order.</p>',
          tracking,
          '<h2>If your order is late or arrives with a problem</h2>',
          `<p>Reach us by ${contactLine(input, 'en')} and we'll sort it out quickly.</p>`,
        ].join('');
  };

  return {
    slug: SHIPPING_POLICY_SLUG,
    title: { ar: 'سياسة الشحن والتوصيل', en: 'Shipping policy', es: 'Política de envíos' },
    metaTitle: { ar: 'سياسة الشحن والتوصيل', en: 'Shipping & delivery policy', es: 'Política de envíos y entregas' },
    metaDescription: {
      ar: `أماكن التوصيل في ${where.ar}، المصاريف ومدة التجهيز والتوصيل، وإزاي تتابع طلبك.`,
      en: `Where we deliver in ${where.en}, delivery fees and times, and how to track your order.`,
      es: `Dónde entregamos en ${where.es}, costes y plazos de envío, y cómo seguir tu pedido.`,
    },
    blocks: [
      block(PageBlockType.RICH_TEXT, { content: { ar: html('ar'), en: html('en'), es: htmlEs() } }),
      block(PageBlockType.FAQ, {
        title: { ar: 'أسئلة شائعة', en: 'Frequently asked questions', es: 'Preguntas frecuentes' },
        items: [
          {
            question: { ar: 'إمتى هيوصلني الطلب؟', en: 'When will my order arrive?', es: '¿Cuándo llegará mi pedido?' },
            answer: {
              ar: 'عادةً خلال 2 إلى 5 أيام عمل من تأكيد الطلب، حسب منطقتك.',
              en: 'Usually within 2–5 business days of confirming the order, depending on your area.',
              es: 'Normalmente en 2–5 días laborables desde la confirmación del pedido, según tu zona.',
            },
          },
          {
            question: { ar: 'ممكن أغيّر العنوان بعد ما أطلب؟', en: 'Can I change the address after ordering?', es: '¿Puedo cambiar la dirección después de hacer el pedido?' },
            answer: {
              ar: 'أيوه، طالما الطلب لسه ما خرجش للشحن. كلمنا في أسرع وقت.',
              en: "Yes, as long as the order hasn't been shipped yet. Contact us as soon as you can.",
              es: 'Sí, mientras el pedido aún no se haya enviado. Contáctanos lo antes posible.',
            },
          },
          {
            question: { ar: 'إيه اللي يحصل لو ماكنتش موجود وقت التوصيل؟', en: "What if I'm not home when it arrives?", es: '¿Qué pasa si no estoy en casa cuando llegue?' },
            answer: {
              ar: 'المندوب بيتواصل معاك قبل ما يوصل، ولو ما اتقابلتوش بنتفق معاك على ميعاد تاني.',
              en: "The courier calls ahead, and if you miss each other we'll arrange another time with you.",
              es: 'El mensajero llama antes de llegar y, si no logran encontrarse, acordaremos otro momento contigo.',
            },
          },
        ],
      }),
    ],
  };
}

function returnPage(input: PolicyInput) {
  const days = input.returnWindowDays ?? 14;

  const html = (lang: 'ar' | 'en' | 'es') => {
    const ar = lang === 'ar';
    const es = lang === 'es';
    const window =
      days > 0
        ? ar
          ? `<p>تقدر ترجّع أو تستبدل المنتج خلال <strong>${days} يوم</strong> من يوم استلامه.</p>`
          : es
            ? `<p>Puedes devolver o cambiar un artículo en un plazo de <strong>${days} días</strong> desde que lo recibes.</p>`
            : `<p>You can return or exchange an item within <strong>${days} days</strong> of receiving it.</p>`
        : ar
          ? '<p>المنتجات المباعة مش بتترجع، إلا لو وصلتك تالفة أو غلط أو مختلفة عن الوصف.</p>'
          : es
            ? '<p>Los artículos vendidos no se pueden devolver, salvo que lleguen dañados, equivocados o distintos de lo descrito.</p>'
            : '<p>Items sold are not returnable, unless they arrive damaged, wrong or not as described.</p>';

    const feeRule = {
      [DeliveryFeeRefundPolicy.FULL_RETURN]: {
        ar: 'لما الطلب كله يرجع، بنرجّعلك مصاريف التوصيل كمان، أيًا كان السبب.',
        en: 'When the whole order comes back, we refund the delivery fee too, whatever the reason.',
        es: 'Cuando se devuelve el pedido completo, reembolsamos también el coste de envío, sea cual sea el motivo.',
      },
      [DeliveryFeeRefundPolicy.STORE_FAULT_FULL_RETURN]: {
        ar: 'لو المنتج وصل تالف أو غلط أو مختلف عن الوصف أو اتأخر، بنتحمّل مصاريف الشحن ونرجّعلك مصاريف التوصيل. في غير كده مصاريف التوصيل الأصلية مش بترجع.',
        en: "If an item arrives damaged, wrong, not as described or late, we cover the shipping and refund the delivery fee. Otherwise the original delivery fee isn't refunded.",
        es: 'Si un artículo llega dañado, equivocado, distinto de lo descrito o con retraso, asumimos el envío y reembolsamos el coste de envío. En otros casos, el coste de envío original no se reembolsa.',
      },
      [DeliveryFeeRefundPolicy.NEVER]: {
        ar: 'مصاريف التوصيل الأصلية مش بترجع.',
        en: "The original delivery fee isn't refunded.",
        es: 'El coste de envío original no se reembolsa.',
      },
    }[input.deliveryFeeRefund ?? DeliveryFeeRefundPolicy.STORE_FAULT_FULL_RETURN];

    const how = input.sellsOnline
      ? es
        ? `<p>En tu cuenta, abre el pedido en Mis pedidos, pulsa <strong>Solicitar una devolución</strong> y elige los artículos y el motivo. O contáctanos por ${contactLine(input, 'es')}.</p>`
        : ar
        ? `<p>من حسابك ← طلباتي، افتح الطلب واضغط <strong>طلب استرجاع</strong> واختار المنتجات والسبب. أو كلمنا على ${contactLine(input, 'ar')}.</p>`
        : `<p>In your account, open the order under My orders, tap <strong>Request a return</strong> and choose the items and the reason. Or reach us by ${contactLine(input, 'en')}.</p>`
      : es
        ? `<p>Contáctanos por ${contactLine(input, 'es')} indicando tu número de pedido y el motivo.</p>`
      : ar
        ? `<p>كلمنا على ${contactLine(input, 'ar')} وقولنا رقم الطلب والسبب.</p>`
        : `<p>Reach us by ${contactLine(input, 'en')} with your order number and the reason.</p>`;

    if (es)
      return [
        '<h2>Plazo de devolución</h2>',
        window,
        '<h2>Condiciones</h2>',
        '<ul><li>El artículo está en su estado original, sin usar y en su embalaje original.</li><li>Tienes el número de pedido o el recibo.</li></ul>',
        '<h2>Artículos que no se pueden devolver</h2>',
        '<ul><li>Artículos hechos o modificados especialmente para ti (con un nombre o un diseño personalizado).</li><li>Artículos que se han usado, o abierto cuando no se pueden revender una vez abiertos.</li></ul>',
        '<p>Esto no se aplica a un artículo que llega dañado o equivocado: lo sustituimos o reembolsamos en todos los casos.</p>',
        '<h2>Cómo solicitar una devolución</h2>',
        how,
        '<h2>Costes de envío</h2>',
        `<p>${feeRule.es}</p>`,
        '<h2>Reembolsos</h2>',
        '<p>Una vez que recibimos y revisamos el artículo, te reembolsamos por el mismo método de pago en un plazo de <strong>7–14 días laborables</strong>.</p>',
      ].join('');

    return ar
      ? [
          '<h2>مدة الاسترجاع</h2>',
          window,
          '<h2>شروط الاسترجاع</h2>',
          '<ul><li>المنتج بحالته الأصلية، مش مستخدم، وفي تغليفه الأصلي.</li><li>معاه رقم الطلب أو الفاتورة.</li></ul>',
          '<h2>منتجات مش بتترجع</h2>',
          '<ul><li>المنتجات اللي اتعملت أو اتعدّلت مخصوص ليك (بالاسم أو بتصميم خاص).</li><li>المنتجات اللي اتستخدمت أو اتفتح تغليفها لو كانت من النوع اللي ما ينفعش يترجع بعد فتحه.</li></ul>',
          '<p>ده ما ينطبقش على المنتج اللي يوصلك تالف أو غلط: ده بنستبدله أو نرجّع فلوسه في كل الأحوال.</p>',
          '<h2>إزاي تطلب استرجاع</h2>',
          how,
          '<h2>مصاريف الشحن</h2>',
          `<p>${feeRule.ar}</p>`,
          '<h2>استرداد المبلغ</h2>',
          '<p>بعد ما نستلم المنتج ونراجعه، بنرجّعلك المبلغ بنفس طريقة الدفع خلال <strong>7 إلى 14 يوم عمل</strong>.</p>',
        ].join('')
      : [
          '<h2>Return window</h2>',
          window,
          '<h2>Conditions</h2>',
          '<ul><li>The item is in its original condition, unused and in its original packaging.</li><li>You have the order number or receipt.</li></ul>',
          "<h2>Items that can't be returned</h2>",
          '<ul><li>Items made or changed especially for you (with a name or a custom design).</li><li>Items that have been used, or opened where they cannot be resold once opened.</li></ul>',
          "<p>This doesn't apply to an item that arrives damaged or wrong: we replace or refund it in every case.</p>",
          '<h2>How to request a return</h2>',
          how,
          '<h2>Shipping costs</h2>',
          `<p>${feeRule.en}</p>`,
          '<h2>Refunds</h2>',
          '<p>Once we receive and check the item, we refund you by the same payment method within <strong>7–14 business days</strong>.</p>',
        ].join('');
  };

  return {
    slug: RETURN_POLICY_SLUG,
    title: { ar: 'سياسة الاسترجاع والاستبدال', en: 'Returns & refunds policy', es: 'Política de devoluciones y reembolsos' },
    metaTitle: { ar: 'سياسة الاسترجاع والاستبدال', en: 'Returns & refunds policy', es: 'Política de devoluciones y reembolsos' },
    metaDescription: {
      ar:
        days > 0
          ? `استرجاع أو استبدال خلال ${days} يوم من الاستلام: الشروط، إزاي تطلب، ومصاريف الشحن واسترداد المبلغ.`
          : 'متى يمكن استرجاع المنتجات، وإزاي تطلب، ومصاريف الشحن واسترداد المبلغ.',
      en:
        days > 0
          ? `Return or exchange within ${days} days of delivery: conditions, how to request, shipping costs and refunds.`
          : 'When items can be returned, how to request it, shipping costs and refunds.',
      es:
        days > 0
          ? `Devolución o cambio en un plazo de ${days} días desde la entrega: condiciones, cómo solicitarlo, costes de envío y reembolsos.`
          : 'Cuándo se pueden devolver los artículos, cómo solicitarlo, costes de envío y reembolsos.',
    },
    blocks: [block(PageBlockType.RICH_TEXT, { content: { ar: html('ar'), en: html('en'), es: html('es') } })],
  };
}

/** Both policy pages, published and linked from the footer. */
export function buildPolicyPages(input: PolicyInput) {
  blockCounter = 0;
  const shared = {
    isPublished: true,
    showInHeader: false,
    showInFooter: true,
    settings: { maxWidth: PageWidth.MD, showTitle: true },
  };
  return [
    { ...shared, order: 90, ...shippingPage(input) },
    { ...shared, order: 91, ...returnPage(input) },
  ];
}
