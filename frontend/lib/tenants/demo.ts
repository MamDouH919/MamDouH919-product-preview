import type { TenantSeo } from "./types";

const demo: TenantSeo = {
  siteName: "Demo Store",
  siteUrl: "http://demo.localhost:3000",
  ar: {
    title: "متجر تجريبي | تصفح المنتجات",
    titleTemplate: "%s | متجر تجريبي",
    description:
      "متجر تجريبي لاستعراض المنتجات. تعرّف على الأسعار والتفاصيل الكاملة لكل منتج.",
    keywords: "متجر تجريبي، منتجات، أسعار، تسوق، عرض المنتجات",
  },
  en: {
    title: "Demo Store | Browse Products",
    titleTemplate: "%s | Demo Store",
    description:
      "A demo storefront for previewing products. View prices and full details for every item.",
    keywords: "demo store, products, prices, shopping, product preview",
  },
  // Assets live under /public/demo/
  icons: {
    shortcut: "/demo/favicon.ico",
    icon: [
      { url: "/demo/icon0.svg", type: "image/svg+xml" },
      { url: "/demo/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/demo/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/demo/manifest.json",
  ogImage: "/demo/logo.webp",
};

export default demo;
