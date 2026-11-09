import { ALL_MODULES, type StoreModule } from "@/lib/storeModules"

/** The parts of the public settings that decide what a product is advertised at. */
export type OfferSettings = {
  currency?: Record<string, string | undefined>
  currencyCode?: string
  country?: string
  showPrices?: boolean
  modules?: StoreModule[]
}

/** The fields of a product (or a feed row) that its offers are worked out from. */
export type OfferProduct = {
  price?: number | null
  compareAtPrice?: number | null
  sku?: string
  gtin?: string
  trackStock?: boolean
  allowBackorder?: boolean
  stock?: number
  variants?: {
    _id: string
    label: string
    price?: number | null
    compareAtPrice?: number | null
    sku?: string
    gtin?: string
    color?: string
    size?: string
    stock?: number
  }[]
}

/** One thing a shopper can buy: the product itself, or one of its variants. */
export type Offer = {
  variantId?: string
  label?: string
  sku?: string
  gtin?: string
  color?: string
  size?: string
  price: number
  /** The price before the discount, only when there is one (higher than `price`). */
  compareAtPrice?: number
  inStock: boolean
}

/** A struck-through price only counts when it's above the selling price. */
export function saleFrom(price: number, compareAt?: number | null): number | undefined {
  return compareAt != null && compareAt > price ? compareAt : undefined
}

/**
 * What a product is for sale at, one offer per variant (or one for the
 * product). The storefront, its structured data and the shopping feeds all
 * read this, so Google never sees one price on the page and another in the feed.
 *
 * Same rules as checkout: a variant without its own price sells at the
 * product's; a store without orders may hide prices, and then nothing is
 * advertised; a store without inventory, or a product that doesn't track
 * stock or allows backorder, is always in stock.
 */
export function productOffers(product: OfferProduct, settings: OfferSettings | null): Offer[] {
  const modules = settings?.modules ?? ALL_MODULES
  const showPrices = modules.includes("orders") || settings?.showPrices !== false
  if (!showPrices) return []

  const alwaysInStock = !modules.includes("inventory") || product.trackStock === false || !!product.allowBackorder

  if (product.variants?.length) {
    return product.variants.flatMap((v) => {
      // A variant inherits the product's price, and with it the product's
      // "was" price; its own "was" price belongs to its own price.
      const price = v.price ?? product.price
      if (price == null) return []
      const compareAt = v.price != null ? v.compareAtPrice : product.compareAtPrice
      return [{
        variantId: v._id,
        label: normalizeSizes(v.label ?? "") || undefined,
        sku: v.sku || product.sku || undefined,
        gtin: v.gtin || undefined,
        color: v.color?.trim() || undefined,
        // Many stores only write the size into the label ("30 ML"); read it from there.
        size: normalizeSizes(v.size ?? "") || sizeFromLabel(v.label),
        price,
        compareAtPrice: saleFrom(price, compareAt),
        inStock: alwaysInStock || (v.stock ?? 0) > 0,
      }]
    })
  }

  if (product.price == null) return []
  return [{
    sku: product.sku || undefined,
    gtin: product.gtin || undefined,
    price: product.price,
    compareAtPrice: saleFrom(product.price, product.compareAtPrice),
    inStock: alwaysInStock || (product.stock ?? 0) > 0,
  }]
}

/** Collapses whitespace and writes volumes one way: "30ml", "30ML ", "30 Ml" → "30 ML". */
export function normalizeSizes(text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*ml(?![\p{L}])/giu, "$1 ML")
    .replace(/\s+/g, " ")
    .trim()
}

/** The volume in a variant label ("كاندي 30ml" → "30 ML"), when it has one. */
export function sizeFromLabel(label?: string): string | undefined {
  const match = label?.match(/(\d+(?:[.,]\d+)?)\s*ml(?![\p{L}])/iu)
  return match ? `${match[1]} ML` : undefined
}

/** A size as a URL/id-safe key: "30 ML" → "30ml". */
export function sizeKey(size: string): string {
  return size.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, "")
}

/** The product page opened on this offer's variant: `?size=30ml`, else `?variant=<id>`. */
export function offerLink(pageUrl: string, offer: Pick<Offer, "size" | "variantId">): string {
  if (offer.size) return `${pageUrl}?size=${encodeURIComponent(sizeKey(offer.size))}`
  if (offer.variantId) return `${pageUrl}?variant=${offer.variantId}`
  return pageUrl
}

/** Which variant a `?size=` / `?variant=` link points at, or -1. */
export function linkedVariantIndex(
  variants: { _id?: string; size?: string; label?: string }[] | undefined,
  params: { size?: string | null; variant?: string | null },
): number {
  if (!variants?.length) return -1
  if (params.variant) {
    const i = variants.findIndex((v) => v._id === params.variant)
    if (i >= 0) return i
  }
  if (params.size) {
    const wanted = sizeKey(params.size)
    return variants.findIndex((v) => {
      const size = normalizeSizes(v.size ?? "") || sizeFromLabel(v.label)
      return !!size && sizeKey(size) === wanted
    })
  }
  return -1
}

/** Descriptions are rich text; structured data, feeds and meta tags want plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

/** A localized field in `locale`, falling back to Arabic then English. */
export function loc(field: Record<string, string | undefined> | undefined | null, locale: string): string {
  if (!field) return ""
  return field[locale] || field["ar"] || field["en"] || ""
}
