import type { TenantSeo } from "./types";

const nuxi: TenantSeo = {
  siteName: "Nuxi",
  siteUrl: "https://nuxi-eg.com",
  ar: {
    title: "Nuxi | قطع غيار سيارات وطنابير رياضية وتيل فرامل سيراميك",
    titleTemplate: "%s | Nuxi",
    description:
      "Nuxi من زين تريد (Sport Brake) في القاهرة: قطع غيار سيارات، طنابير رياضية، طنابير اسبور وتيل فرامل سيراميك. تصفّح المنتجات واعرف الأسعار والتفاصيل الكاملة لكل قطعة.",
    keywords:
      "Nuxi، زين تريد، Zain Trade، سبورت بريك، Sport Brake، قطع غيار سيارات، طنابير رياضية، طنابير اسبور، تيل فرامل سيراميك، اتيال فرامل سيراميك، تيل فرامل، فرامل سيارات، أنظمة فرامل رياضية، قطع غيار سيارات القاهرة، أسعار تيل الفرامل",
  },
  en: {
    title: "Nuxi | Car Parts, Sport Brake Discs & Ceramic Brake Pads",
    titleTemplate: "%s | Nuxi",
    description:
      "Nuxi by Zain Trade (Sport Brake), Cairo: car spare parts, sport brake discs, performance rotors and ceramic brake pads. Browse products and see prices and full details for every part.",
    keywords:
      "Nuxi, Zain Trade, Sport Brake, car spare parts, auto parts Egypt, sport brake discs, performance brake rotors, ceramic brake pads, brake pads, car brakes, auto parts Cairo, brake pad prices",
  },
  // Assets live under /public/nuxi/
  icons: {
    shortcut: "/nuxi/favicon.ico",
    icon: [
      { url: "/nuxi/icon0.svg", type: "image/svg+xml" },
      { url: "/nuxi/icon1.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/nuxi/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/nuxi/manifest.json",
  ogImage: "/nuxi/logo.webp",
};

export default nuxi;
