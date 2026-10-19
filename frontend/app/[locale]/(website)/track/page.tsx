import type { Metadata } from "next"
import TrackOrderClient from "./_TrackOrderClient"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === "ar" ? "تتبع طلبك" : "Track your order",
    // A lookup form, not content — nothing here for search engines.
    robots: { index: false, follow: true },
  }
}

export default function TrackOrderPage() {
  return <TrackOrderClient />
}
