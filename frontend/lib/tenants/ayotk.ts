import type { TenantSeo } from "./types";

const en = {
  title: "AYOTK | Luxury Perfumes & Fragrances Online",
  titleTemplate: "%s | AYOTK",
  description:
    "Shop AYOTK perfumes and fragrances for men and women. Discover signature scents, eau de parfum and gift-worthy fragrances. Your Scent... Your Identity.",
  h1: "AYOTK Perfumes: Your Scent, Your Identity",
  productsHeading: "Shop Perfumes & Fragrances",
};

const es = {
  title: "AYOTK | Perfumes y Fragancias de Lujo en Línea",
  titleTemplate: "%s | AYOTK",
  description:
    "Compra perfumes y fragancias AYOTK para hombre y mujer. Descubre aromas exclusivos, eau de parfum y fragancias ideales para regalar. Tu aroma... tu identidad.",
  h1: "Perfumes AYOTK: Tu aroma, tu identidad",
  productsHeading: "Compra perfumes y fragancias",
};

// US-targeted store published in English and Spanish. `ar` is required by the
// type but never served, so it mirrors `en`.
const ayotk: TenantSeo = {
  siteName: "AYOTK",
  siteUrl: "https://ayotk.com",
  en,
  es,
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
