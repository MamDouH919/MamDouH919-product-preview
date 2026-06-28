import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "../globals.css";
import Providers from "@/lib/Providers";
import config from "@/config.json";
import { resolveTenantSeo } from "@/lib/tenantSeo";

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
  const { title, titleTemplate, description, keywords } = tenant[lang];

  return {
    metadataBase: new URL(tenant.siteUrl),
    applicationName: tenant.siteName,

    title: {
      default: title,
      template: titleTemplate,
    },

    description,
    keywords,

    authors: [{ name: tenant.siteName }],
    category: "Perfumes & Fragrances",

    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },

    icons: tenant.icons,

    manifest: tenant.manifest,

    openGraph: {
      type: "website",
      siteName: tenant.siteName,
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
