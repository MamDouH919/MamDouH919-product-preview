import type { MetadataRoute } from "next";
import { fetchBackend, getStoreLocales, languageAlternates, requestBackendUrl, requestOrigin } from "@/lib/seo";
import { withBackend } from "@/lib/getBackendUrl";

type Entry = { slug: string; updatedAt?: string; image?: string };
type SitemapData = { products: Entry[]; categories: Entry[]; pages: Entry[] };

/**
 * Every public storefront URL for the tenant this request came in on: each
 * page once per language the store is published in (/ar/… and /en/…), each
 * listing all of them as hreflang alternates, itself included, as Google asks.
 * That tells search engines they are one page in several languages, not
 * competing copies, and gets the English pages crawled too. Languages the
 * store isn't published in are left out: their URLs only redirect.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, backendUrl, data, locales] = await Promise.all([
    requestOrigin(),
    requestBackendUrl(),
    fetchBackend<SitemapData>("/sitemap", 3600),
    getStoreLocales(),
  ]);

  // The default language first, so it leads the file.
  const ordered = [locales.defaultLanguage, ...locales.languages.filter((l) => l !== locales.defaultLanguage)];

  const entry = (
    path: string,
    options: Partial<MetadataRoute.Sitemap[number]> = {}
  ): MetadataRoute.Sitemap => {
    const languages = languageAlternates(origin, path, locales);
    return ordered.map((locale) => ({
      url: `${origin}/${locale}${path}`,
      ...(languages ? { alternates: { languages } } : {}),
      ...options,
    }));
  };

  const lastModified = (e: Entry) => (e.updatedAt ? new Date(e.updatedAt) : undefined);

  return [
    ...entry("", { changeFrequency: "daily", priority: 1 }),
    ...entry("/products", { changeFrequency: "daily", priority: 0.9 }),
    ...entry("/categories", { changeFrequency: "weekly", priority: 0.7 }),
    ...entry("/contact", { changeFrequency: "yearly", priority: 0.3 }),
    ...(data?.categories ?? []).flatMap((c) =>
      entry(`/categories/${encodeURIComponent(c.slug)}`, {
        lastModified: lastModified(c),
        changeFrequency: "weekly",
        priority: 0.7,
      })
    ),
    ...(data?.products ?? []).flatMap((p) =>
      entry(`/products/${encodeURIComponent(p.slug)}`, {
        lastModified: lastModified(p),
        changeFrequency: "weekly",
        priority: 0.8,
        images: p.image && backendUrl ? [withBackend(backendUrl, p.image)] : undefined,
      })
    ),
    ...(data?.pages ?? []).flatMap((p) =>
      entry(`/${encodeURIComponent(p.slug)}`, {
        lastModified: lastModified(p),
        changeFrequency: "monthly",
        priority: 0.5,
      })
    ),
  ];
}
