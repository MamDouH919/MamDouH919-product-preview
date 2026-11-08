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
        label: v.label,
        sku: v.sku || product.sku || undefined,
        gtin: v.gtin || undefined,
        color: v.color?.trim() || undefined,
        size: v.size?.trim() || undefined,
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
