import type { TenantSeo } from "./types";

export const GRAVITY_DOMAIN = "https://gravity.novaslash.com";

const localhost: TenantSeo = {
  siteName: "Gravity",
  siteUrl: GRAVITY_DOMAIN,
  ar: {
    // Title 50–60 characters, description 120–160: what search results show in full.
    // The price and delivery claims must stay true: update them when they change.
    title: "جراڤيتي | عطور فاخرة مستوحاة من أشهر الماركات العالمية",
    titleTemplate: "%s | جراڤيتي",
    description:
      "تسوّق عطور جراڤيتي الفاخرة المستوحاة من أشهر الماركات العالمية بأسعار تبدأ من 300 جنيه. عطور رجالي وحريمي ويونيسكس مع توصيل سريع لكل محافظات مصر.",
    h1: "عطور فاخرة مستوحاة من أشهر الماركات",
    productsHeading: "عطور جراڤيتي الفاخرة",
  },
  en: {
    title: "Gravity | Luxury Perfumes Inspired by World-Famous Brands",
    titleTemplate: "%s | Gravity",
    description:
      "Shop Gravity luxury perfumes inspired by the world's most famous brands, from 300 EGP. Men's, women's and unisex scents with fast delivery across Egypt.",
    h1: "Luxury Perfumes Inspired by the World's Most Famous Brands",
    productsHeading: "Gravity Luxury Perfumes",
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
  contentSiteVerify: "-wIhSV_jn_zCy-hWqan_gS2G--R3VhfqH6MpuJchrUs"
};

export default localhost;
