import type { MetadataRoute } from "next";
import { requestOrigin } from "@/lib/seo";
import { SUPPORTED_LOCALES } from "@/lib/locales";

/** Per tenant: reading the request host makes this render per request, not once at build. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await requestOrigin();

  // Pages with no search value, or that only make sense for one signed-in person.
  const privatePaths = ["admin", "account", "cart", "checkout", "orders", "login", "forgot-password", "reset-password"];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Every supported locale, not just the store's: a language it isn't
      // published in only redirects, but its private paths stay private anyway.
      disallow: SUPPORTED_LOCALES.flatMap((locale) => privatePaths.map((path) => `/${locale}/${path}`)),
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
