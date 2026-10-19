"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/Store/store";
import { useOrderByIdQuery } from "@/backend-api/orders/hooks";
import { Order } from "@/backend-api/orders/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { formatAddress, formatMoney, localized } from "@/features/Order/format";

type Doc = "invoice" | "packing-slip";

const formatDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "long" });

/**
 * Invoice and packing slip, laid out for A4 paper. Lives outside the admin
 * layout so nothing but the document prints; "Save as PDF" in the browser's
 * print dialog is the PDF — it keeps Arabic shaping and RTL right, which PDF
 * libraries often don't.
 */
function PrintableOrder({ order, doc }: { order: Order; doc: Doc }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const settings = useAppSelector((s) => s.settings);
  const storeName = localized(settings.siteTitle, lang);
  const currency = localized(order.currency, lang) || localized(settings.currency, lang);
  const customer = typeof order.customer === "object" ? order.customer : undefined;
  const a = order.shippingAddress;
  const isInvoice = doc === "invoice";
  const money = (n: number) => formatMoney(n, currency);

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-6">
        <div className="flex flex-col gap-2">
          {settings.logo && (
            // Plain img: next/image lazy-loads, and a lazy image can miss the print.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={getBackendUri(settings.logo) ?? ""} alt="" className="h-12 w-auto self-start object-contain" />
          )}
          {storeName && <p className="text-base font-bold">{storeName}</p>}
          <div className="text-neutral-600">
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p><bdi dir="ltr">{settings.phone}</bdi></p>}
            {settings.email && <p><bdi dir="ltr">{settings.email}</bdi></p>}
          </div>
        </div>
        <div className="text-end">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{t(isInvoice ? "invoice" : "packingSlip")}</h1>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-neutral-700">
            <dt>{t("order")}</dt>
            <dd className="font-semibold">#{order.orderNumber}</dd>
            <dt>{t("date")}</dt>
            <dd>{formatDate(order.createdAt, lang)}</dd>
            {isInvoice && (
              <>
                <dt>{t("paymentMethod")}</dt>
                <dd>{t(`paymentMethods.${order.paymentMethod}`)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      {/* Parties */}
      <section className="grid grid-cols-2 gap-8 py-6">
        {isInvoice && (
          <div>
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("billTo")}</h2>
            <p className="font-semibold">{customer?.name ?? a.fullName}</p>
            {customer?.email && <p><bdi dir="ltr">{customer.email}</bdi></p>}
            <p><bdi dir="ltr">{a.phone}</bdi></p>
          </div>
        )}
        <div className={isInvoice ? "" : "col-span-2"}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("shipTo")}</h2>
          <p className={isInvoice ? "font-semibold" : "text-lg font-bold"}>{a.fullName}</p>
          <p><bdi dir="ltr">{a.phone}</bdi></p>
          <p>{formatAddress(a, lang)}</p>
          {a.notes && <p className="mt-1 text-neutral-600">{a.notes}</p>}
        </div>
      </section>

      {/* Lines */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-300 text-[11px] uppercase tracking-wider text-neutral-500">
            {!isInvoice && <th className="w-8 py-2" />}
            <th className="py-2 text-start font-semibold">{t("item")}</th>
            <th className="py-2 text-start font-semibold">{t("sku")}</th>
            <th className="py-2 text-center font-semibold">{t("quantity")}</th>
            {isInvoice && <th className="py-2 text-end font-semibold">{t("unitPrice")}</th>}
            {isInvoice && <th className="py-2 text-end font-semibold">{t("total")}</th>}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200 align-top [break-inside:avoid]">
              {!isInvoice && (
                <td className="py-2.5">
                  <span className="inline-block h-4 w-4 rounded-sm border border-neutral-500" aria-hidden />
                </td>
              )}
              <td className="py-2.5 pe-3">
                <p className="font-medium">{localized(item.name, lang)}</p>
                {item.variantLabel && <p className="text-neutral-600">{item.variantLabel}</p>}
              </td>
              <td className="py-2.5 pe-3 text-neutral-600" dir="ltr">{item.sku ?? "—"}</td>
              <td className={`py-2.5 text-center tabular-nums ${isInvoice ? "" : "text-base font-bold"}`}>{item.quantity}</td>
              {isInvoice && <td className="py-2.5 text-end tabular-nums whitespace-nowrap">{money(item.unitPrice)}</td>}
              {isInvoice && <td className="py-2.5 text-end tabular-nums whitespace-nowrap">{money(item.lineTotal)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {isInvoice ? (
        <section className="mt-4 flex justify-end [break-inside:avoid]">
          <dl className="grid w-72 grid-cols-[1fr_auto] gap-y-1.5 tabular-nums">
            <dt className="text-neutral-600">{t("subtotal")}</dt>
            <dd className="text-end">{money(order.subtotal)}</dd>
            {!!order.discount && (
              <>
                <dt className="text-neutral-600">
                  {t("discount")}
                  {order.coupon?.code ? ` (${order.coupon.code})` : ""}
                </dt>
                <dd className="text-end">− {money(order.discount)}</dd>
              </>
            )}
            <dt className="text-neutral-600">{t("delivery")}</dt>
            <dd className="text-end">{order.shippingFee > 0 ? money(order.shippingFee) : t("free")}</dd>
            <dt className="border-t border-neutral-300 pt-2 text-base font-bold">{t("total")}</dt>
            <dd className="border-t border-neutral-300 pt-2 text-end text-base font-bold">{money(order.total)}</dd>
            {!!order.refundedTotal && (
              <>
                <dt className="text-neutral-600">{t("refunded")}</dt>
                <dd className="text-end">− {money(order.refundedTotal)}</dd>
              </>
            )}
          </dl>
        </section>
      ) : (
        <p className="mt-4 text-end text-neutral-600">
          {t("totalItems")}: <span className="font-bold text-neutral-900">{order.items.reduce((s, i) => s + i.quantity, 0)}</span>
        </p>
      )}

      {order.notes && (
        <section className="mt-6 rounded border border-neutral-300 p-3 [break-inside:avoid]">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("orderNotes")}</h2>
          <p className="whitespace-pre-line">{order.notes}</p>
        </section>
      )}

      <footer className="mt-10 border-t border-neutral-200 pt-4 text-center text-neutral-500">
        {isInvoice ? t("invoiceThanks") : storeName}
      </footer>
    </article>
  );
}

function PrintPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const doc: Doc = searchParams.get("doc") === "packing-slip" ? "packing-slip" : "invoice";
  const { isLoggedIn, isInitialized } = useAppSelector((s) => s.auth);
  const ready = isInitialized && isLoggedIn;
  const { data: order, isLoading } = useOrderByIdQuery(ready ? id : "");

  useEffect(() => {
    if (isInitialized && !isLoggedIn) router.replace(`/${i18n.language}/login`);
  }, [isInitialized, isLoggedIn, router, i18n.language]);

  useEffect(() => {
    if (order) document.title = `${t(doc === "invoice" ? "invoice" : "packingSlip")} #${order.orderNumber}`;
  }, [order, doc, t]);

  const switchTo = (next: Doc) => router.replace(`?doc=${next}`);

  return (
    <div className="min-h-dvh bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <button
          type="button"
          onClick={() => router.push(`/${i18n.language}/admin/orders/${id}`)}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← {t("back")}
        </button>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-300 bg-white p-0.5 text-sm">
            {(["invoice", "packing-slip"] as Doc[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => switchTo(d)}
                className={`rounded-md px-3 py-1.5 ${doc === d ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
              >
                {t(d === "invoice" ? "invoice" : "packingSlip")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!order}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("printOrSavePdf")}
          </button>
        </div>
      </div>

      {!ready || isLoading ? (
        <p className="text-center text-neutral-500">…</p>
      ) : order ? (
        <PrintableOrder order={order} doc={doc} />
      ) : (
        <p className="text-center text-neutral-500">{t("orderNotFound")}</p>
      )}

      <style>{`@page { size: A4; margin: 14mm; }`}</style>
    </div>
  );
}

export default function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <PrintPage id={id} />
    </Suspense>
  );
}
