import type { TenantSeo } from "./types";

const localhost: TenantSeo = {
  siteName: "Gravity",
  siteUrl: "http://localhost:3000",
  ar: {
    title: "جراڤيتي | عطور فاخرة",
    titleTemplate: "%s | جراڤيتي",
    description:
      "اكتشف مجموعة جراڤيتي من العطور الفاخرة. تعرّف على الأسعار والتفاصيل الكاملة لكل منتج.",
    keywords:
      "عطور، عطور فاخرة، جراڤيتي، بخور، أسعار عطور، عطر رجالي، عطر نسائي، تشكيلة عطور",
  },
  en: {
    title: "Gravity | Luxury Perfumes",
    titleTemplate: "%s | Gravity",
    description:
      "Explore Gravity's exclusive luxury perfume collection. View prices and full product details for every fragrance.",
    keywords:
      "perfumes, luxury perfumes, Gravity, fragrances, scents, cologne, perfume prices, fragrance collection, men perfume, women perfume",
  },
  icons: {
    shortcut: "/gravity/favicon.ico",
    icon: [
      { url: "/gravity/icon0.svg", type: "image/svg+xml" },
      { url: "/gravity/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/gravity/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/gravity/manifest.json",
  ogImage: "/gravity/logo.webp",
};

export default localhost;
