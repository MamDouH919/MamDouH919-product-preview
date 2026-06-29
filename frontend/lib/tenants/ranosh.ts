import type { TenantSeo } from "./types";

export const RANOSH_DOMAIN = "https://ranosh.novaslash.com";

const ranosh: TenantSeo = {
  siteName: "Ranosh",
  siteUrl: RANOSH_DOMAIN,
  ar: {
    title: "رانوش | تفاصيل يدوية لكل مناسباتك",
    titleTemplate: "%s | رانوش",
    description:
      "رانوش تصنع الفرحة بتفاصيل يدوية تفيض بالحب والإتقان: شنط خرز، صواني خطوبة، مبخرة ومروحة العروسة، مناديل كتب كتاب، تابلوهات فرح مطرزة، بصمات أكريليك وخشب، بوكيهات عروسة، وتوزيعات لكل المناسبات. تخيّلي ونحن نُنفّذ بأعلى جودة وبلمستك الخاصة.",
    keywords:
      "رانوش، توزيعات، شنط خرز، صواني خطوبة، مناديل كتب كتاب، تابلوهات فرح، بصمات أكريليك، بصمات خشب، بوكيهات عروسة، مكرميات، هاند ميد، مناسبات، خطوبة، فرح، سبوع، توزيعات أفراح",
  },
  en: {
    title: "Ranosh | Handmade Details for Every Occasion",
    titleTemplate: "%s | Ranosh",
    description:
      "Ranosh crafts joy with handmade details made with love and precision: beaded bags, engagement trays, bridal incense burners and fans, marriage-contract handkerchiefs, embroidered wedding boards, acrylic and wood keepsakes, bridal bouquets, and favors for every occasion. Imagine it, and we make it.",
    keywords:
      "Ranosh, handmade, wedding favors, beaded bags, engagement trays, marriage contract handkerchiefs, bridal bouquet, macrame, acrylic keepsakes, occasions, engagement, wedding, handmade gifts",
  },
  // Assets live under /public/ranosh/
  icons: {
    shortcut: "/ranosh/favicon.ico",
    icon: [
      { url: "/ranosh/icon0.svg", type: "image/svg+xml" },
      { url: "/ranosh/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/ranosh/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/ranosh/manifest.json",
  ogImage: "/ranosh/logo.webp",
};

export default ranosh;
