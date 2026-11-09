import { isHttpsUrl, withBackend } from "@/lib/getBackendUrl"
import {
  loc,
  normalizeSizes,
  offerLink,
  plainText,
  productOffers,
  sizeKey,
  type OfferProduct,
  type OfferSettings,
} from "@/lib/productOffer"

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
  /**
   * Image URLs known not to load (checked by the route). Items left without a
   * working image are skipped: Google disapproves an item whose image 404s.
   */
  brokenImages?: ReadonlySet<string>
  /** Called for every product or variant left out of the feed, with why. */
  onSkip?: (id: string, reason: string) => void
}

/** Every image a product lists, as the absolute URL the feed would send. */
export function feedImageUrls(product: Pick<FeedProduct, "images">, backendUrl: string): string[] {
  return (product.images ?? []).filter(Boolean).map((img) => withBackend(backendUrl, img.trim()))
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

const tag = (name: string, value: string | undefined) => {
  const text = value?.replace(/\s+/g, " ").trim()
  return text ? `<${name}>${escapeXml(text)}</${name}>` : ""
}

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
    const skip = (reason: string) => {
      ctx.onSkip?.(product._id, reason)
      return []
    }

    const images = feedImageUrls(product, backendUrl).filter((img) => isHttpsUrl(img) && !ctx.brokenImages?.has(img))
    // Google disapproves items without a working image; leave them out instead.
    if (!images.length) {
      return skip(product.images?.length ? `no loadable https image (${product.images.join(", ")})` : "no image")
    }

    const name = normalizeSizes(loc(product.name, locale))
    if (!name) return skip("no title")
    const description =
      plainText(loc(product.description, locale)) || plainText(loc(product.shortDescription, locale)) || name
    const productType = [loc(product.category?.name, locale), loc(product.subCategory?.name, locale)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" > ")
    const pageUrl = `${origin}/${locale}/products/${encodeURIComponent(product.slug)}`
    const brand = product.brand?.trim() || ctx.storeName
    const googleCategory = product.category?.googleProductCategory?.trim()

    // Google rejects a zero price; older variants saved without one hold 0.
    const offers = productOffers(product, settings).filter((o) => o.price > 0)
    if (!offers.length) return skip("no price")
    const grouped = !!product.variants?.length && offers.length > 1

    // Each variant needs its own id, the same on every build and in every
    // language: the size when it has one ("<id>-30ml"), else the variant's id.
    const usedIds = new Set<string>()
    return offers.map((offer, index) => {
      let id = product._id
      if (product.variants?.length) {
        const suffix = offer.size ? sizeKey(offer.size) : offer.color ? sizeKey(offer.color) : offer.variantId
        id = `${product._id}-${suffix || index + 1}`
        if (usedIds.has(id)) id = `${id}-${offer.variantId ?? index + 1}`
      }
      usedIds.add(id)

      const title = offer.label && !name.endsWith(offer.label) ? `${name} - ${offer.label}` : name
      // The page preselects the variant, so the price Google crawls is this one.
      const link = offerLink(pageUrl, offer)

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
