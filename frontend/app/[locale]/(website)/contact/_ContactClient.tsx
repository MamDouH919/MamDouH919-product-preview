"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useTheme, alpha } from "@mui/material/styles"
import { Box, Button } from "@mui/material"
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle2,
  Navigation,
  Send,
  Sparkles,
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
    <div className="group flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/20">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">{label}</p>
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-[15px] font-semibold text-white hover:underline underline-offset-4 wrap-break-word"
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

  const hasContactDetails = !!(
    settings?.address ||
    settings?.phone ||
    settings?.landLine ||
    settings?.email
  )

  return (
    <div className="min-h-screen bg-gray-50" style={cssVars}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-(--primary) text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.25),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle,#fff_1px,transparent_1px)] bg-size-[22px_22px]"
        />
        <div aria-hidden className="absolute -top-24 -end-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 start-1/4 w-96 h-96 rounded-full bg-black/20 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-36 sm:pt-20 sm:pb-44 text-center">
          <nav className="inline-flex items-center gap-2 text-sm text-white/70 mb-6">
            <CustomLink href="/" className="hover:text-white transition-colors">
              {t("home")}
            </CustomLink>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            <span className="text-white">{t("contactUs")}</span>
          </nav>
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur px-4 py-1.5 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              {t("getInTouch")}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            {t("contactUs")}
          </h1>
          <p className="text-white/75 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t("contactSubtitle")}
          </p>
        </div>
      </section>

      {/* Card */}
      <div className="relative max-w-6xl mx-auto px-4 -mt-24 sm:-mt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 bg-white rounded-[28px] shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] ring-1 ring-gray-900/5 overflow-hidden">
          {/* Info panel */}
          <aside className="relative lg:col-span-2 overflow-hidden bg-(--primary) text-white p-8 sm:p-10 flex flex-col">
            <div
              aria-hidden
              className="absolute inset-0 bg-linear-to-br from-black/10 via-black/20 to-black/45"
            />
            <div aria-hidden className="absolute -bottom-20 -end-20 w-64 h-64 rounded-full border-40 border-white/5" />
            <div aria-hidden className="absolute -top-10 -start-10 w-40 h-40 rounded-full bg-white/5" />

            <div className="relative flex flex-col flex-1">
              <h2 className="text-2xl font-bold mb-2">{t("contactInfo")}</h2>
              <p className="text-sm text-white/70 leading-relaxed mb-8">
                {t("contactInfoSubtitle")}
              </p>

              {settingsLoading ? (
                <div className="flex flex-col gap-5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-white/10 animate-pulse" />
                      <div className="flex-1 h-4 rounded-full bg-white/10 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : !hasContactDetails ? (
                <div aria-hidden className="flex-1 flex items-center justify-center py-8">
                  <div className="relative w-28 h-28 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                    <div className="absolute inset-3 rounded-full bg-white/5 ring-1 ring-white/10" />
                    <MessageCircle className="relative w-10 h-10 text-white/70" />
                  </div>
                </div>
              ) : (
                (
                  <div className="flex flex-col gap-6">
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
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white"
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
                )
              )}

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#25d366] hover:bg-[#1ebe5d] text-white font-semibold text-sm shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("chatOnWhatsApp")}
                </a>
              )}

              {socialLinks.length > 0 && (
                <div className="mt-auto pt-10">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="h-px flex-1 bg-white/15" />
                    <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                      {t("followUs")}
                    </p>
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                  <Box sx={{ "& a span": { color: "rgba(255,255,255,0.8)" }, "& .MuiContainer-root": { px: 0 } }}>
                    <SocialMediaLinks
                      links={socialLinks.map((s) => ({ code: s.key, link: s.value }))}
                    />
                  </Box>
                </div>
              )}
            </div>
          </aside>

          {/* Form */}
          <div className="lg:col-span-3 p-8 sm:p-10 lg:p-12">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-green-50 ring-8 ring-green-50/60 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mt-2">{t("contactSubmitted")}</h2>
                <p className="text-gray-500 max-w-sm leading-relaxed">{t("contactSubmittedText")}</p>
                <Button
                  variant="outlined"
                  sx={{ mt: 1, borderRadius: 999, px: 4 }}
                  onClick={handleSendAnother}
                >
                  {t("sendAnother")}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-(--primary-10) text-(--primary) flex items-center justify-center mb-4">
                    <Send className="w-5 h-5 rtl:-scale-x-100" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    {t("sendMessage")}
                  </h2>
                  <p className="text-gray-500 mt-1.5">{t("getInTouch")}</p>
                </div>

                <Box
                  component="form"
                  onSubmit={handleSubmit((d) => mutate(d))}
                  noValidate
                  className="grid grid-cols-1 sm:grid-cols-2 gap-5"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "14px",
                      backgroundColor: "#f8fafc",
                      transition: "background-color .2s, box-shadow .2s",
                      "& fieldset": { borderColor: "#e2e8f0" },
                      "&:hover fieldset": { borderColor: "#cbd5e1" },
                      "&.Mui-focused": {
                        backgroundColor: "#fff",
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}`,
                      },
                    },
                    "& .MuiInputBase-input:not(textarea)": { py: 1.6 },
                    "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { top: 4 },
                  }}
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
                      rows={6}
                      placeholder={t("yourMessageHere") ?? undefined}
                    />
                  </div>
                  <div className="sm:col-span-2 pt-1">
                    <Button
                      fullWidth
                      size="large"
                      variant="contained"
                      type="submit"
                      loading={isPending}
                      endIcon={<Send className="w-4 h-4 rtl:-scale-x-100" />}
                      sx={{
                        py: 1.6,
                        borderRadius: "14px",
                        fontWeight: 700,
                        fontSize: "1rem",
                        boxShadow: `0 12px 24px -10px ${alpha(theme.palette.primary.main, 0.6)}`,
                        transition: "transform .2s, box-shadow .2s",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: `0 16px 30px -10px ${alpha(theme.palette.primary.main, 0.7)}`,
                        },
                      }}
                    >
                      {t("sendMessage")}
                    </Button>
                  </div>
                </Box>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
