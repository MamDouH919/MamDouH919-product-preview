# TODO: أحداث المتجر في GA4 و Meta Pixel

الحالة: **لم يُنفّذ بعد.**

## الموجود حالياً
[components/Analytics.tsx](../components/Analytics.tsx) يحمّل GA4 والـ Pixel لكل متجر عنده `gaId` / `fbPixelId`
في `lib/tenants/<store>.ts`، ويبعت **PageView بس**.

## الناقص
أحداث التجارة، اللي بتخلّي GA4 يحسب المبيعات وإعلانات فيسبوك تعرف مين اشترى (Conversions + Retargeting).

| الحدث | GA4 | Meta Pixel | المكان في الكود |
|---|---|---|---|
| عرض منتج | `view_item` | `ViewContent` | صفحة المنتج `app/[locale]/(website)/products/[slug]` (الجزء الـ client) |
| إضافة للسلة | `add_to_cart` | `AddToCart` | [features/Cart/AddToCart.tsx](../features/Cart/AddToCart.tsx) جنب `dispatch(addToCart(...))`، و [components/ProductCard.tsx](../components/ProductCard.tsx) |
| بدء الدفع | `begin_checkout` | `InitiateCheckout` | أول فتح لـ [checkout/page.tsx](../app/[locale]/(website)/checkout/page.tsx) |
| الشراء | `purchase` | `Purchase` | `onSuccess` في `orderMutation` و `guestMutation` في checkout/page.tsx |

## خطة التنفيذ
1. ملف `lib/track.ts` فيه دوال صغيرة (`trackAddToCart`, `trackPurchase`, ...) بتنادي
   `window.gtag?.(...)` و `window.fbq?.(...)`. لو السكريبت مش متحمّل، مفيش حاجة بتحصل.
2. البيانات اللي تتبعت: `currency` (ISO زي `EGP`، مش "جنيه")، `value`، و `items`
   (`item_id`, `item_name`, `item_variant`, `price`, `quantity`). للـ Pixel: `content_ids`, `content_type: "product"`, `value`, `currency`.
3. `purchase` لازم يتبعت مرة واحدة بس لكل طلب: استخدم رقم الطلب كـ `transaction_id` في GA4 و `eventID` في الـ Pixel،
   عشان لو الصفحة اتعملها refresh ما يتحسبش مرتين.
4. اختياري لاحقاً: **Meta Conversions API** من الـ backend (NestJS) عند إنشاء الطلب، بنفس `eventID`
   عشان فيسبوك يشيل التكرار. ده بيعوّض الزيارات اللي فيها ad-blocker أو iOS tracking prevention.

## التحقق
- GA4 → Admin → **DebugView** (مع إضافة Google Analytics Debugger في Chrome)، و Reports → Monetization.
- Meta Events Manager → **Test events**، وإضافة **Meta Pixel Helper** في Chrome.
