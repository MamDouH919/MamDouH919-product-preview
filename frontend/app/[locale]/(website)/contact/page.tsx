"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useTheme, alpha } from "@mui/material/styles"
import { Button } from "@mui/material"
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle2,
  Navigation,
} from "lucide-react"
import CustomLink from "@/components/CustomLink"
import TextInputComponent from "@/components/MUI/ControlMUItextField"
import SocialMediaLinks from "@/components/Social"
import { useSettingsQuery } from "@/backend-api/settings/hooks"
import { sendContactMessage } from "@/backend-api/contact/mutations"
import { CreateContactPayload } from "@/backend-api/contact/types"

function InfoRow({
  icon,
  label,
  value,
  href,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href: string
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-(--primary-10) text-(--primary) flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-sm font-semibold text-gray-800 hover:text-(--primary) transition-colors wrap-break-word"
        >
          {value}
        </a>
        {extra}
      </div>
    </div>
  )
}

export default function ContactPage() {
  const { t } = useTranslation()
  const theme = useTheme()
  const [submitted, setSubmitted] = useState(false)

  const { data: settings, isLoading: settingsLoading } = useSettingsQuery()

  const { control, handleSubmit, reset } = useForm<CreateContactPayload>({
    defaultValues: { name: "", email: "", phone: "", subject: "", message: "" },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: sendContactMessage,
    onSuccess: () => setSubmitted(true),
    onError: (error: any) => {
      const message = error?.response?.data?.message
      toast.error(typeof message === "string" ? message : t("somethingWentWrong"))
    },
  })

  const handleSendAnother = () => {
    reset()
    setSubmitted(false)
  }

  const socialLinks = (settings?.socialMedia ?? []).filter((s) => s.value)
  const whatsappHref = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : null
  const mapHref = settings?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-10": alpha(theme.palette.primary.main, 0.1),
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-gray-50" style={cssVars}>
      {/* Hero */}
      <div className="bg-(--primary) text-white py-14 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
            <CustomLink href="/" className="hover:text-white transition-colors">
              {t("home")}
            </CustomLink>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            <span className="text-white">{t("contactUs")}</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">{t("contactUs")}</h1>
          <p className="text-white/70 text-lg max-w-xl">{t("contactSubtitle")}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-10 gap-3">
                <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{t("contactSubmitted")}</h2>
                <p className="text-gray-500 max-w-sm">{t("contactSubmittedText")}</p>
                <Button variant="outlined" sx={{ mt: 1 }} onClick={handleSendAnother}>
                  {t("sendAnother")}
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((d) => mutate(d))}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                noValidate
              >
                <TextInputComponent
                  label={t("name")}
                  control={control}
                  name="name"
                  required
                />
                <TextInputComponent
                  label={t("email")}
                  control={control}
                  name="email"
                  rules={{
                    required: t("fieldIsRequired"),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: t("invalidEmail"),
                    },
                  }}
                />
                <TextInputComponent label={t("phone")} control={control} name="phone" />
                <TextInputComponent label={t("subject")} control={control} name="subject" />
                <div className="sm:col-span-2">
                  <TextInputComponent
                    label={t("message")}
                    control={control}
                    name="message"
                    required
                    multiline
                    rows={5}
                    placeholder={t("yourMessageHere") ?? undefined}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    type="submit"
                    loading={isPending}
                  >
                    {t("sendMessage")}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Info panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-lg font-bold text-gray-800 mb-1">{t("contactInfo")}</h2>
              <p className="text-sm text-gray-500 mb-6">{t("contactInfoSubtitle")}</p>

              {settingsLoading ? (
                <div className="flex flex-col gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {settings?.address && (
                    <InfoRow
                      icon={<MapPin className="w-5 h-5" />}
                      label={t("address")}
                      value={settings.address}
                      href={mapHref ?? "#"}
                      extra={
                        mapHref && (
                          <a
                            href={mapHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-(--primary) hover:underline"
                          >
                            <Navigation className="w-3 h-3" />
                            {t("getDirections")}
                          </a>
                        )
                      }
                    />
                  )}
                  {settings?.phone && (
                    <InfoRow
                      icon={<Phone className="w-5 h-5" />}
                      label={t("phone")}
                      value={settings.phone}
                      href={`tel:${settings.phone}`}
                    />
                  )}
                  {settings?.landLine && (
                    <InfoRow
                      icon={<Phone className="w-5 h-5" />}
                      label={t("landLine")}
                      value={settings.landLine}
                      href={`tel:${settings.landLine}`}
                    />
                  )}
                  {settings?.email && (
                    <InfoRow
                      icon={<Mail className="w-5 h-5" />}
                      label={t("email")}
                      value={settings.email}
                      href={`mailto:${settings.email}`}
                    />
                  )}
                </div>
              )}

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-white font-semibold text-sm transition-colors duration-200"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("chatOnWhatsApp")}
                </a>
              )}
            </div>

            {socialLinks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-6">
                <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  {t("followUs")}
                </p>
                <SocialMediaLinks
                  links={socialLinks.map((s) => ({ code: s.key, link: s.value }))}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
