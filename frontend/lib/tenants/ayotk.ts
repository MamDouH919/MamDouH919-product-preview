import type { TenantSeo } from "./types";

const en = {
  title: "AYOTK | Luxury Perfumes & Fragrances Online",
  titleTemplate: "%s | AYOTK",
  description:
    "Shop AYOTK perfumes and fragrances for men and women. Discover signature scents, eau de parfum and gift-worthy fragrances. Your Scent... Your Identity.",
  h1: "AYOTK Perfumes: Your Scent, Your Identity",
  productsHeading: "Shop Perfumes & Fragrances",
};

// US-targeted, English-only store. `ar` is required by the type but never
// served (the store publishes English only), so it mirrors `en`.
const ayotk: TenantSeo = {
  siteName: "AYOTK",
  siteUrl: "https://ayotk.com",
  en,
  ar: en,
  // Assets live under /public/ayotk/
  icons: {
    shortcut: "/ayotk/favicon.ico",
    icon: [
      { url: "/ayotk/icon0.svg", type: "image/svg+xml" },
      { url: "/ayotk/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/ayotk/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/ayotk/manifest.json",
  ogImage: "/ayotk/logo.webp",
};

export default ayotk;
