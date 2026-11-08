import { withBackend } from "@/lib/getBackendUrl"
import { loc, plainText, productOffers, type OfferProduct, type OfferSettings } from "@/lib/productOffer"

/**
 * Google Merchant Center product feed (RSS 2.0 + the `g:` namespace) for one
 * store in one language. Pure: the route fetches, this only writes XML.
 * Spec: https://support.google.com/merchants/answer/7052112
 */

type Localized = Record<string, string | undefined>

export type FeedProduct = OfferProduct & {
  _id: string
  slug: string
  name: Localized
  description?: Localized
  shortDescription?: Localized
  images?: string[]
  brand?: string
  category?: { name?: Localized; googleProductCategory?: string } | null
  subCategory?: { name?: Localized } | null
}

export type FeedSettings = OfferSettings & { flatDeliveryPrice?: number | null }

export type FeedContext = {
  locale: string
  /** ISO 4217; the route refuses to build a feed without one. */
  currency: string
  /** Storefront origin, e.g. https://ranosh.novaslash.com */
  origin: string
  /** Backend origin, for images stored as /uploads/... paths. */
  backendUrl: string
  /** The store's name — the brand of everything it makes itself. */
  storeName: string
  title: string
  description: string
}

/** Google's limits; longer values are rejected, not truncated. */
const MAX_TITLE = 150
const MAX_DESCRIPTION = 5000
const MAX_EXTRA_IMAGES = 10

const escapeXml = (value: string) =>
  value
    // Characters XML 1.0 forbids outright; pasted text sometimes carries them.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const clip = (value: string, max: number) => (value.length > max ? value.slice(0, max - 1).trimEnd() + "…" : value)

const tag = (name: string, value: string | undefined) => (value ? `<${name}>${escapeXml(value)}</${name}>` : "")

export function buildGoogleFeed(products: FeedProduct[], settings: FeedSettings, ctx: FeedContext): string {
  const { locale, currency, origin, backendUrl } = ctx
  const decimals =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
  const money = (amount: number) => `${amount.toFixed(decimals)} ${currency}`

  const country = settings.country?.toUpperCase()
  const shipping =
    country && settings.flatDeliveryPrice != null
      ? `<g:shipping>${tag("g:country", country)}${tag("g:price", money(settings.flatDeliveryPrice))}</g:shipping>`
      : ""

  const items = products.flatMap((product) => {
    const images = (product.images ?? []).map((img) => withBackend(backendUrl, img))
    // Google rejects items without an image.
    if (!images.length) return []

    const name = loc(product.name, locale)
    const description =
      plainText(loc(product.description, locale)) || plainText(loc(product.shortDescription, locale)) || name
    const productType = [loc(product.category?.name, locale), loc(product.subCategory?.name, locale)]
      .filter(Boolean)
      .join(" > ")
    const pageUrl = `${origin}/${locale}/products/${encodeURIComponent(product.slug)}`
    const brand = product.brand?.trim() || ctx.storeName
    const googleCategory = product.category?.googleProductCategory?.trim()

    // Google rejects a zero price; older variants saved without one hold 0.
    const offers = productOffers(product, settings).filter((o) => o.price > 0)
    // Variants are grouped only when they say how they differ — Google rejects
    // a group whose members share every attribute.
    const grouped = offers.length > 1 && offers.some((o) => o.color || o.size)

    return offers.map((offer) => {
      const id = offer.variantId ? `${product._id}_${offer.variantId}` : product._id
      const title = offer.label ? `${name} - ${offer.label}` : name
      // The page preselects the variant, so the price Google crawls is this one.
      const link = offer.variantId ? `${pageUrl}?variant=${offer.variantId}` : pageUrl

      return [
        "<item>",
        tag("g:id", id),
        tag("g:title", clip(title, MAX_TITLE)),
        tag("g:description", clip(description, MAX_DESCRIPTION)),
        tag("g:link", link),
        tag("g:image_link", images[0]),
        ...images.slice(1, 1 + MAX_EXTRA_IMAGES).map((img) => tag("g:additional_image_link", img)),
        tag("g:availability", offer.inStock ? "in_stock" : "out_of_stock"),
        // On sale, `price` is the old price and `sale_price` what it sells at.
        tag("g:price", money(offer.compareAtPrice ?? offer.price)),
        offer.compareAtPrice ? tag("g:sale_price", money(offer.price)) : "",
        tag("g:condition", "new"),
        tag("g:brand", brand),
        tag("g:gtin", offer.gtin),
        // Own-made goods have no GTIN; brand + the store's SKU identify them.
        offer.sku ? tag("g:mpn", offer.sku) : offer.gtin ? "" : tag("g:identifier_exists", "no"),
        tag("g:google_product_category", googleCategory),
        tag("g:product_type", productType),
        grouped ? tag("g:item_group_id", product._id) : "",
        grouped ? tag("g:color", offer.color) : "",
        grouped ? tag("g:size", offer.size) : "",
        shipping,
        "</item>",
      ].join("")
    })
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", ctx.title),
    tag("link", `${origin}/${locale}`),
    tag("description", ctx.description),
    ...items,
    "</channel>",
    "</rss>",
  ].join("\n")
}
