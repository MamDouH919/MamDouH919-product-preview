"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { Container } from "@mui/material"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AnimateIn, StaggerChild, StaggerGroup, scaleIn } from "@/components/Animate"
import { getBackendUri } from "@/utils/helperFunctions"
import { hasHtml, useHomeSection } from "./useHomeSection"

// Tile shapes repeat every six images; `grid-flow-dense` fills the gaps they leave.
const TILE_SPANS = [
  "col-span-2 row-span-2",
  "",
  "row-span-2",
  "",
  "col-span-2",
  "",
]

function Lightbox({
  images,
  index,
  onClose,
  onChange,
}: {
  images: string[]
  index: number
  onClose: () => void
  onChange: (i: number) => void
}) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.dir() === "rtl"
  const count = images.length
  const next = useCallback(() => onChange((index + 1) % count), [index, count, onChange])
  const prev = useCallback(() => onChange((index - 1 + count) % count), [index, count, onChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") (isRtl ? prev : next)()
      if (e.key === "ArrowLeft") (isRtl ? next : prev)()
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose, next, prev, isRtl])

  const control =
    "flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20"

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/90 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="relative h-[80vh] w-[92vw] max-w-6xl"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image src={images[index]} alt="" fill sizes="92vw" className="object-contain" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-5 inset-x-5 flex items-center justify-between">
        <span dir="ltr" className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 tabular-nums">
          {index + 1} / {count}
        </span>
        <button type="button" onClick={onClose} aria-label={t("close")} className={control}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {count > 1 && (
        <div dir="ltr" className="absolute inset-x-5 bottom-6 flex justify-center gap-3 md:inset-x-8 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:justify-between">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); (isRtl ? next : prev)() }}
            aria-label={t(isRtl ? "next" : "previous")}
            className={control}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); (isRtl ? prev : next)() }}
            aria-label={t(isRtl ? "previous" : "next")}
            className={control}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </motion.div>,
    document.body
  )
}

export default function GallerySection({ sectionName = "home-gallery" }: { sectionName?: string }) {
  const { section, text, cssVars } = useHomeSection(sectionName)
  const { t } = useTranslation()
  const [open, setOpen] = useState<number | null>(null)
  const closeLightbox = useCallback(() => setOpen(null), [])

  const images = (section?.gallery ?? []).map(getBackendUri)
  if (!section || !images.length) return null

  const title = text(section.title)
  const description = text(section.description)

  return (
    <section className="py-12 md:py-20" style={cssVars}>
      <Container>
        <div className="px-4">
          {(title || hasHtml(description)) && (
            <AnimateIn className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                {title && (
                  <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl">
                    {title}
                  </h2>
                )}
                {hasHtml(description) && (
                  <div
                    className="mt-4 text-base leading-8 text-gray-500 md:text-lg"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
              <span className="hidden shrink-0 text-7xl font-black leading-none text-(--primary)/15 md:block tabular-nums" dir="ltr">
                {String(images.length).padStart(2, "0")}
              </span>
            </AnimateIn>
          )}

          <StaggerGroup className="grid grid-flow-dense auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[200px] md:grid-cols-4 md:gap-4 lg:auto-rows-[240px]">
            {images.map((src, i) => (
              <StaggerChild key={src + i} variants={scaleIn} className={TILE_SPANS[i % TILE_SPANS.length]}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`${t("open", { defaultValue: "Open" })} ${i + 1}`}
                  className="group relative block h-full w-full overflow-hidden rounded-3xl bg-gray-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="absolute bottom-4 end-4 flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-white text-gray-900 opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    <Expand className="h-4 w-4" />
                  </span>
                </button>
              </StaggerChild>
            ))}
          </StaggerGroup>
        </div>
      </Container>

      <AnimatePresence>
        {open !== null && (
          <Lightbox images={images} index={open} onClose={closeLightbox} onChange={setOpen} />
        )}
      </AnimatePresence>
    </section>
  )
}
