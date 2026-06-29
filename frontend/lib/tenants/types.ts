import type { Metadata } from "next";

export type LocaleSeo = {
  title: string;
  titleTemplate: string;
  description: string;
  keywords: string;
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
};
