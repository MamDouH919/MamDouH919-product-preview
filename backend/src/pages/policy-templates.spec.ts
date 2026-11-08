import { buildPolicyPages, RETURN_POLICY_SLUG, SHIPPING_POLICY_SLUG } from './policy-templates';
import { DeliveryFeeRefundPolicy } from '../settings/schemas/setting.schema';

const html = (pages: ReturnType<typeof buildPolicyPages>, slug: string, lang: 'ar' | 'en') =>
  (pages.find((p) => p.slug === slug)!.blocks[0].data as any).content[lang] as string;

describe('policy page templates', () => {
  const base = { country: 'EG', currency: { ar: 'ج.م', en: 'EGP' }, sellsOnline: true };

  it('writes both pages, published and in the footer', () => {
    const pages = buildPolicyPages(base);
    expect(pages.map((p) => p.slug)).toEqual([SHIPPING_POLICY_SLUG, RETURN_POLICY_SLUG]);
    for (const page of pages) {
      expect(page).toMatchObject({ isPublished: true, showInFooter: true, showInHeader: false });
      expect(page.title.ar && page.title.en).toBeTruthy();
    }
    // Block ids are unique, as the page builder expects.
    const ids = pages.flatMap((p) => p.blocks.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('states a flat delivery fee, or says it depends on the area', () => {
    expect(html(buildPolicyPages({ ...base, flatDeliveryPrice: 60 }), SHIPPING_POLICY_SLUG, 'ar')).toContain('60 ج.م');
    expect(html(buildPolicyPages({ ...base, flatDeliveryPrice: null }), SHIPPING_POLICY_SLUG, 'en')).toContain(
      'depends on your area',
    );
    expect(html(buildPolicyPages(base), SHIPPING_POLICY_SLUG, 'ar')).toContain('مصر');
  });

  it('uses the store return window, and says so when there is none', () => {
    expect(html(buildPolicyPages({ ...base, returnWindowDays: 30 }), RETURN_POLICY_SLUG, 'ar')).toContain('30 يوم');
    const none = html(buildPolicyPages({ ...base, returnWindowDays: 0 }), RETURN_POLICY_SLUG, 'en');
    expect(none).toContain('<p>Items sold are not returnable');
  });

  it('describes the delivery-fee refund rule the store applies', () => {
    const rule = (deliveryFeeRefund: DeliveryFeeRefundPolicy) =>
      html(buildPolicyPages({ ...base, deliveryFeeRefund }), RETURN_POLICY_SLUG, 'en');
    expect(rule(DeliveryFeeRefundPolicy.FULL_RETURN)).toContain('whatever the reason');
    expect(rule(DeliveryFeeRefundPolicy.NEVER)).toContain("isn't refunded");
    expect(rule(DeliveryFeeRefundPolicy.STORE_FAULT_FULL_RETURN)).toContain('damaged, wrong');
  });

  it('points to tracking and account returns only for stores that take orders', () => {
    expect(html(buildPolicyPages(base), SHIPPING_POLICY_SLUG, 'ar')).toContain('href="/ar/track"');
    expect(html(buildPolicyPages(base), RETURN_POLICY_SLUG, 'en')).toContain('Request a return');
    const catalog = buildPolicyPages({ ...base, sellsOnline: false });
    expect(html(catalog, SHIPPING_POLICY_SLUG, 'ar')).not.toContain('/track');
    expect(html(catalog, RETURN_POLICY_SLUG, 'en')).not.toContain('Request a return');
  });

  it('escapes contact details written into the HTML', () => {
    const page = html(buildPolicyPages({ ...base, email: 'a<b>@x.com', whatsapp: '0100' }), SHIPPING_POLICY_SLUG, 'en');
    expect(page).toContain('a&lt;b&gt;@x.com');
    expect(page).toContain('WhatsApp 0100');
  });
});
