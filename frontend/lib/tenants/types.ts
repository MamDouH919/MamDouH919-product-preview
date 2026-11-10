import type { Metadata } from "next";

export type LocaleSeo = {
  title: string;
  titleTemplate: string;
  description: string;
  /** The home page's H1. Should differ from `title` and carry its main keywords; defaults to `title`. */
  h1?: string;
  /** The home page's products heading (an H2); defaults to the generic "Products". */
  productsHeading?: string;
};

export type TenantSeo = {
  siteName: string;
  /** Base URL used for metadataBase / openGraph. */
  siteUrl: string;
  ar: LocaleSeo;
  en: LocaleSeo;
  icons: Metadata["icons"];
  manifest: string;
  /** Open Graph / Twitter share image. */
  ogImage: string;
  contentSiteVerify?: string;
  /**
   * Google Analytics 4 measurement ID ("G-XXXXXXXXXX"). Per store, not an env
   * variable: one server serves every store, and one env value would send all
   * of their traffic to the same property. Unset: GA isn't loaded.
   */
  gaId?: string;
  /** Meta (Facebook) Pixel ID, digits only. Unset: the pixel isn't loaded. */
  fbPixelId?: string;
};
