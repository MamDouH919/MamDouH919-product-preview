"use client"

import { usePathname } from "next/navigation"
import { useAppSelector } from "@/Store/store"
import { useTranslation } from "react-i18next"

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 1.77.463 3.432 1.27 4.876L2 22l5.27-1.235A9.959 9.959 0 0 0 12.004 22C17.53 22 22 17.523 22 12.004 22 6.477 17.53 2 12.004 2zm0 18.198a8.19 8.19 0 0 1-4.187-1.148l-.3-.178-3.13.733.764-2.948-.196-.302A8.19 8.19 0 0 1 3.802 12c0-4.523 3.68-8.202 8.202-8.202 4.524 0 8.203 3.679 8.203 8.202 0 4.524-3.68 8.198-8.203 8.198z" />
    </svg>
  )
}

interface Props {
  slug: string
  productName: string
  variant?: "icon" | "full"
  className?: string
}

export default function WhatsAppButton({ slug, productName, variant = "icon", className }: Props) {
  const { t } = useTranslation()
  const whatsapp = useAppSelector((s) => s.settings.whatsapp)
  const pathname = usePathname()
  const locale = pathname.split("/")[1] ?? "ar"

  if (!whatsapp) return null

  const productUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/products/${slug}`
      : `/${locale}/products/${slug}`

  const message = `${t("whatsappProductMessage")}\n${productUrl}`
  const phone = whatsapp.replace(/\D/g, "")
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  if (variant === "full") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-white font-semibold text-sm transition-colors duration-200 ${className ?? ""}`}
      >
        <WhatsAppIcon size={20} />
        {t("whatsappMoreDetails")}
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={t("whatsappMoreDetails")}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#25d366] hover:bg-[#1ebe5d] text-white transition-colors duration-200 shrink-0 ${className ?? ""}`}
    >
      <WhatsAppIcon size={16} />
    </a>
  )
}
