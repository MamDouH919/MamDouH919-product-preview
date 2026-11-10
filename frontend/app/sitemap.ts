import type { MetadataRoute } from "next";
import { fetchBackend, getStoreLocales, languageAlternates, requestBackendUrl, requestOrigin } from "@/lib/seo";
import { withBackend } from "@/lib/getBackendUrl";

type Entry = { slug: string; updatedAt?: string; image?: string };
type SitemapData = { products: Entry[]; categories: Entry[]; pages: Entry[] };

/**
 * Every public storefront URL for the tenant this request came in on. One
 * entry per page in the store's default language, with its other languages
 * (if any) listed as hreflang alternates, so search engines see one page in
 * several languages rather than competing copies. Languages the store isn't
 * published in are left out: their URLs only redirect.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, backendUrl, data, locales] = await Promise.all([
    requestOrigin(),
    requestBackendUrl(),
    fetchBackend<SitemapData>("/sitemap", 3600),
    getStoreLocales(),
  ]);

  const entry = (
    path: string,
    options: Partial<MetadataRoute.Sitemap[number]> = {}
  ): MetadataRoute.Sitemap[number] => {
    const languages = languageAlternates(origin, path, locales);
    return {
      url: `${origin}/${locales.defaultLanguage}${path}`,
      ...(languages ? { alternates: { languages } } : {}),
      ...options,
    };
  };

  const lastModified = (e: Entry) => (e.updatedAt ? new Date(e.updatedAt) : undefined);

  return [
    entry("", { changeFrequency: "daily", priority: 1 }),
    entry("/products", { changeFrequency: "daily", priority: 0.9 }),
    entry("/categories", { changeFrequency: "weekly", priority: 0.7 }),
    entry("/contact", { changeFrequency: "yearly", priority: 0.3 }),
    ...(data?.categories ?? []).map((c) =>
      entry(`/categories/${encodeURIComponent(c.slug)}`, {
        lastModified: lastModified(c),
        changeFrequency: "weekly",
        priority: 0.7,
      })
    ),
    ...(data?.products ?? []).map((p) =>
      entry(`/products/${encodeURIComponent(p.slug)}`, {
        lastModified: lastModified(p),
        changeFrequency: "weekly",
        priority: 0.8,
        images: p.image && backendUrl ? [withBackend(backendUrl, p.image)] : undefined,
      })
    ),
    ...(data?.pages ?? []).map((p) =>
      entry(`/${encodeURIComponent(p.slug)}`, {
        lastModified: lastModified(p),
        changeFrequency: "monthly",
        priority: 0.5,
      })
    ),
  ];
}
