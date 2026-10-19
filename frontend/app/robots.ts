import type { MetadataRoute } from "next";
import { LOCALES, requestOrigin } from "@/lib/seo";

/** Per tenant: reading the request host makes this render per request, not once at build. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await requestOrigin();

  // Pages with no search value, or that only make sense for one signed-in person.
  const privatePaths = ["admin", "account", "cart", "checkout", "orders", "login", "forgot-password", "reset-password"];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: LOCALES.flatMap((locale) => privatePaths.map((path) => `/${locale}/${path}`)),
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
