import type { TenantSeo } from "./types";

const mk: TenantSeo = {
  siteName: "MK Dental Hub",
  siteUrl: "https://mk.novaslash.com",
  ar: {
    title: "إم كيه دنتال هب | مستلزمات طب الأسنان المستوردة",
    titleTemplate: "%s | إم كيه دنتال هب",
    description:
      "إم كيه دنتال هب (Tänder) لمستلزمات طب الأسنان المستوردة. تصفّح المنتجات وتعرّف على الأسعار والتفاصيل الكاملة لكل منتج.",
    keywords:
      "إم كيه دنتال هب، مستلزمات طب الأسنان، مستلزمات أسنان مستوردة، أدوات طب الأسنان، مستلزمات عيادات الأسنان، أسعار مستلزمات الأسنان",
  },
  en: {
    title: "MK Dental Hub | Imported Dental Supplies",
    titleTemplate: "%s | MK Dental Hub",
    description:
      "MK Dental Hub (Tänder) for imported dental supplies. Browse products and view prices and full details for every item.",
    keywords:
      "MK Dental Hub, Tänder, dental supplies, imported dental supplies, dental instruments, dental clinic supplies, dental supply prices",
  },
  // Assets live under /public/mk/
  icons: {
    shortcut: "/mk/favicon.ico",
    icon: [
      { url: "/mk/icon0.svg", type: "image/svg+xml" },
      { url: "/mk/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/mk/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/mk/manifest.json",
  ogImage: "/mk/logo.webp",
};

export default mk;
