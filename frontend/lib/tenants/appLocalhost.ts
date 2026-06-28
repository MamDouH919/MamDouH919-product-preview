import type { TenantSeo } from "./types";

const appLocalhost: TenantSeo = {
  siteName: "Tenant Two",
  siteUrl: "http://app.localhost:3000",
  ar: {
    title: "المتجر الثاني | متجرك",
    titleTemplate: "%s | المتجر الثاني",
    description: "وصف SEO الخاص بالمتجر الثاني.",
    keywords: "المتجر الثاني، كلمات مفتاحية",
  },
  en: {
    title: "Tenant Two | Your Store",
    titleTemplate: "%s | Tenant Two",
    description: "SEO description for the second tenant.",
    keywords: "tenant two, keywords",
  },
  // Place these files under /public/tenants/app.localhost/
  icons: {
    shortcut: "/tenants/app.localhost/favicon.ico",
    icon: [
      { url: "/tenants/app.localhost/icon.svg", type: "image/svg+xml" },
      { url: "/tenants/app.localhost/icon.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/tenants/app.localhost/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/tenants/app.localhost/manifest.json",
  ogImage: "/tenants/app.localhost/logo.webp",
};

export default appLocalhost;
