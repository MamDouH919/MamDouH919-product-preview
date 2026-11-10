import { headers } from "next/headers"
import { fetchBackend, requestBackendUrl, requestOrigin } from "@/lib/seo"
import { withBackend } from "@/lib/getBackendUrl"
import { resolveTenantSeo } from "@/lib/tenantSeo"
import { ALL_MODULES, type StoreModule } from "@/lib/storeModules"
import type { Section } from "@/backend-api/sections/types"

/**
 * schema.org structured data shared by the storefront's pages. Google reads it
 * for the store's knowledge panel, breadcrumbs in results, and the price,
 * stock, shipping and returns shown with products.
 */

/** Renders structured data. "<" is escaped so catalogue text can never close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  )
}

/** Home → … → here. `path` is after the locale; the last crumb is the page itself. */
export function breadcrumbLd(origin: string, locale: string, crumbs: { name: string; path: string }[]) {
  const home = { name: locale === "ar" ? "الرئيسية" : "Home", path: "" }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [home, ...crumbs].map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${origin}/${locale}${crumb.path}`,
    })),
  }
}

export type StoreSettings = {
  logo?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  country?: string
  socialMedia?: { key?: string; value?: string }[]
  returnWindowDays?: number
  flatDeliveryPrice?: number | null
  modules?: StoreModule[]
}

/** The store as the settings and tenant config describe it, for this request. */
export async function storeContext() {
  const [h, origin, backendUrl, settings, pages] = await Promise.all([
    headers(),
    requestOrigin(),
    requestBackendUrl(),
    fetchBackend<StoreSettings>("/settings", 60),
    // Same request the layout prefetches for the footer, so Next makes it once.
    fetchBackend<{ slug: string }[]>("/pages/navigation", 60),
  ])
  const tenant = resolveTenantSeo(h.get("x-forwarded-host") ?? h.get("host"))
  return { origin, backendUrl, settings, tenant, pages }
}

/** The page `npm run seed:policies` creates for returns, if the store has published it. */
export const RETURN_POLICY_SLUG = "return-policy"

export function returnPolicyUrl(origin: string, locale: string, pages: { slug: string }[] | null) {
  return pages?.some((p) => p.slug === RETURN_POLICY_SLUG) ? `${origin}/${locale}/${RETURN_POLICY_SLUG}` : undefined
}

/**
 * The store's return policy, for stores that take orders (only they have
 * returns). Google applies a policy on the organization to all its products.
 */
export function returnPolicyLd(settings: StoreSettings | null, link?: string) {
  const modules = settings?.modules ?? ALL_MODULES
  if (!modules.includes("orders") || !settings?.country || settings.returnWindowDays == null) return undefined
  const days = settings.returnWindowDays
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: settings.country.toUpperCase(),
    ...(days > 0
      ? { returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: days }
      : { returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" }),
    // The full policy, in words, for shoppers and for Merchant Center.
    merchantReturnLink: link,
  }
}

/** One flat delivery fee for the whole country; per-area price lists can't be stated here. */
export function shippingLd(settings: StoreSettings | null, currency: string | undefined) {
  if (!currency || !settings?.country || settings.flatDeliveryPrice == null) return undefined
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: settings.flatDeliveryPrice, currency },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: settings.country.toUpperCase() },
  }
}

/** The store itself and its site, for the home page. */
export async function storeLd(locale: string) {
  const { origin, backendUrl, settings, tenant, pages } = await storeContext()
  const seo = tenant[locale === "ar" ? "ar" : "en"]
  const logo = settings?.logo ? withBackend(backendUrl, settings.logo) : `${origin}${tenant.ogImage}`
  // Profiles that are the store's own pages. A WhatsApp link is a phone number,
  // not a profile: it is already the store's `telephone`.
  const sameAs = (settings?.socialMedia ?? [])
    .filter((s) => s.key?.toUpperCase() !== "WHATSAPP")
    .map((s) => s.value?.trim())
    .filter((v): v is string => !!v && /^https?:\/\//i.test(v) && !/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(v))
  const telephone = settings?.phone || settings?.whatsapp || undefined
  const orgId = `${origin}/#organization`
  const arabicName = tenant.ar.title.split("|")[0].trim()

  const organization = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": orgId,
    name: tenant.siteName,
    url: origin,
    logo,
    image: logo,
    description: seo.description,
    email: settings?.email || undefined,
    telephone,
    address: settings?.address
      ? {
          "@type": "PostalAddress",
          streetAddress: settings.address,
          addressCountry: settings.country?.toUpperCase(),
        }
      : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    hasMerchantReturnPolicy: returnPolicyLd(settings, returnPolicyUrl(origin, locale, pages)),
  }

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: tenant.siteName,
    // The Arabic name ("رانوش") when the site name is the Latin one, so either finds the store.
    alternateName: arabicName && arabicName !== tenant.siteName ? arabicName : undefined,
    url: `${origin}/${locale}`,
    inLanguage: locale,
    publisher: { "@id": orgId },
  }

  return [organization, website]
}

/**
 * schema.org FAQPage from an FAQ section, in this page's language, or null when
 * it has nothing to publish. Must match what FaqSection shows: Google asks that
 * every question and answer in the markup be visible on the page.
 */
export async function faqLd(sectionName: string, locale: string) {
  // Same path and revalidate as the page's prefetch, so the request is made once.
  const section = await fetchBackend<Section>(`/sections/name/${sectionName}`, 60)
  if (!section || section.active === false) return null

  const pick = (field?: Record<string, string | undefined>) => (field?.[locale] || field?.ar || field?.en || "").trim()
  const mainEntity = (section.faqs ?? [])
    .map((f) => ({ question: pick(f.question), answer: pick(f.answer) }))
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    }))
  if (!mainEntity.length) return null

  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity }
}
