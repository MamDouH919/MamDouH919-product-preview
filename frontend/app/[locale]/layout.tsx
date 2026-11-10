import type { Metadata } from "next";
import { headers } from "next/headers";
import { cairo } from "@/lib/fonts";
import "../globals.css";
import Providers from "@/lib/Providers";
import { notFound } from "next/navigation";
import { resolveTenantSeo } from "@/lib/tenantSeo";
import { fetchBackend, getStoreLocales, requestOrigin, storeShareImage } from "@/lib/seo";
import { isRtl, isSupportedLocale, ogLocale } from "@/lib/locales";


export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;

  const host = (await headers()).get("host");
  const tenant = resolveTenantSeo(host);

  const lang = locale === "ar" ? "ar" : "en";
  const { title, titleTemplate, description } = tenant[lang];
  const { siteName, icons } = tenant;
  const image = await storeShareImage(await requestOrigin(), siteName);

  return {
    metadataBase: new URL(tenant.siteUrl),
    applicationName: siteName,

    title: {
      default: title,
      template: titleTemplate,
    },

    description,
    authors: [{ name: siteName }],

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
      locale: ogLocale(locale),
      // 1200×630 JPEG built from the logo (app/api/og/store): the logo itself
      // is square WebP, which Facebook and WhatsApp crop or drop.
      images: [image],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
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
  // "/xx/..." for a language the site has no translations for. One it has but
  // the store isn't published in never gets here: the proxy redirects it.
  if (!isSupportedLocale(locale)) notFound();
  const rtl = isRtl(locale);


  const host = (await headers()).get("host");
  const tenant = resolveTenantSeo(host);
  // Fresh within a minute of a change in the dashboard; the client refreshes it too.
  const [settings, storeLocales] = await Promise.all([
    fetchBackend<Record<string, unknown>>("/settings", 60),
    getStoreLocales(),
  ]);

  return (
    <html
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className={`${cairo.variable} h-full antialiased`}
    >
      <head>
        {tenant.contentSiteVerify && <meta name="google-site-verification" content={tenant.contentSiteVerify} />}
      </head>
      <body className="min-h-full flex flex-col">
        <Providers locale={locale} initialSettings={settings} storeLocales={storeLocales}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
