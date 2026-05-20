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

async function fetchSiteSettings() {
  if (!process.env.NEXT_PUBLIC_BACKEND_URL) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function getLocalizedString(field: any, locale: string): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[locale] || field[config.app.defaultLanguage] || "";
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  const settings = await fetchSiteSettings();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

  const title = getLocalizedString(settings?.siteTitle, locale) || "Blue Sky";
  const description = getLocalizedString(settings?.siteDescription, locale);

  return {
    title,
    description,
    icons: {
      icon: settings?.favicon ? `${backendUrl}${settings.favicon}` : "/favicon.ico",
      apple: settings?.logo ? `${backendUrl}${settings.logo}` : undefined,
    },
    openGraph: {
      title,
      description,
      images: settings?.logo ? [`${backendUrl}${settings.logo}`] : [],
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
