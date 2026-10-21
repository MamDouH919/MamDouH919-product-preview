import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "../globals.css";
import Providers from "@/lib/Providers";
import config from "@/config.json";
import { resolveTenantSeo } from "@/lib/tenantSeo";
import { fetchBackend, requestBackendUrl } from "@/lib/seo";
import { withBackend } from "@/lib/getBackendUrl";

type Localized = Partial<Record<"en" | "ar", string>>;
type StoreSettings = { siteTitle?: Localized; siteDescription?: Localized; favicon?: string };

/** The store's text in this language, or the other one; `undefined` when unset. */
const pick = (field: Localized | undefined, lang: "en" | "ar") =>
  field?.[lang]?.trim() || field?.[lang === "en" ? "ar" : "en"]?.trim() || undefined;

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

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;

  const host = (await headers()).get("host");
  const tenant = resolveTenantSeo(host);

  const lang = locale === "ar" ? "ar" : "en";
  const seo = tenant[lang];

  // What the store set in Settings wins over the built-in per-host defaults:
  // a store renamed in the admin must not keep showing the template's name.
  const [settings, backendUrl] = await Promise.all([
    fetchBackend<StoreSettings>("/settings", 60),
    requestBackendUrl(),
  ]);
  const storeTitle = pick(settings?.siteTitle, lang);
  const siteName = storeTitle ?? tenant.siteName;
  const title = storeTitle ?? seo.title;
  const titleTemplate = storeTitle ? `%s | ${storeTitle}` : seo.titleTemplate;
  const description = pick(settings?.siteDescription, lang) ?? seo.description;
  const { keywords } = seo;
  const icons = settings?.favicon && backendUrl
    ? { icon: withBackend(backendUrl, settings.favicon), shortcut: withBackend(backendUrl, settings.favicon), apple: withBackend(backendUrl, settings.favicon) }
    : tenant.icons;

  return {
    metadataBase: new URL(tenant.siteUrl),
    applicationName: siteName,

    title: {
      default: title,
      template: titleTemplate,
    },

    description,
    keywords,

    authors: [{ name: siteName }],
    category: "Perfumes & Fragrances",

    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },

    icons,

    manifest: tenant.manifest,

    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: title }],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [tenant.ogImage],
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
