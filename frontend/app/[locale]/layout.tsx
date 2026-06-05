import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "../globals.css";
import Providers from "@/lib/Providers";
import config from "@/config.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
});

const SITE_DEFAULTS = {
  ar: {
    title: "جراڤيتي | عطور فاخرة",
    titleTemplate: "%s | جراڤيتي",
    description: "اكتشف مجموعة جراڤيتي من العطور الفاخرة. تعرّف على الأسعار والتفاصيل الكاملة لكل منتج.",
    keywords: "عطور، عطور فاخرة، جراڤيتي، بخور، أسعار عطور، عطر رجالي، عطر نسائي، تشكيلة عطور",
  },
  en: {
    title: "Gravity | Luxury Perfumes",
    titleTemplate: "%s | Gravity",
    description: "Explore Gravity's exclusive luxury perfume collection. View prices and full product details for every fragrance.",
    keywords: "perfumes, luxury perfumes, Gravity, fragrances, scents, cologne, perfume prices, fragrance collection, men perfume, women perfume",
  },
} as const;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const lang = locale === "ar" ? "ar" : "en";
  const { title, titleTemplate, description, keywords } = SITE_DEFAULTS[lang];

  return {
    metadataBase: new URL(siteUrl),
    applicationName: "Gravity",

    title: {
      default: title,
      template: titleTemplate,
    },

    description,
    keywords,

    authors: [{ name: "Gravity" }],
    category: "Perfumes & Fragrances",

    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },

    icons: {
      shortcut: "/favicon.ico",
      icon: [
        { url: "/icon0.svg", type: "image/svg+xml" },
        { url: "/icon1.png", type: "image/png", sizes: "any" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    },

    manifest: "/manifest.json",

    openGraph: {
      type: "website",
      siteName: "Gravity",
      title,
      description,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      images: [{ url: "/logo.webp", width: 1200, height: 630, alt: title }],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/logo.webp"],
    },
  };
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const isRtl = config.app.rtlLanguages.includes(locale);

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers locale={locale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
