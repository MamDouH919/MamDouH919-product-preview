import type { Metadata } from "next"
import ContactClient from "./_ContactClient"
import { pageMetadata } from "@/lib/seo"

const COPY = {
  ar: { title: "تواصل معنا", description: "عندك سؤال أو طلب خاص؟ تواصل معانا بالتليفون أو الواتساب أو ابعتلنا رسالة وهنرد عليك في أقرب وقت." },
  en: { title: "Contact us", description: "Have a question or a special request? Reach us by phone or WhatsApp, or send us a message and we'll get back to you soon." },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return pageMetadata({ locale, path: "/contact", ...COPY[locale === "ar" ? "ar" : "en"] })
}

export default function ContactPage() {
  return <ContactClient />
}
