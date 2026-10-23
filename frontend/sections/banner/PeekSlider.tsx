"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import { useTheme } from "@mui/material/styles"
import {
  AUTOPLAY_MS,
  SWIPE_THRESHOLD,
  navButton,
  SliderIndicators,
  useActiveBanners,
  usePlaybackBlockers,
} from "./shared"

const GAP = 16
const DURATION = 600

// Slide width as a share of the container; the rest is split into the two side peeks.
// Kept in CSS (not measured in JS) so the server render matches the client and
// there is no first-paint jump.
const FRAME =
  "relative w-full overflow-hidden [--slide:90%] sm:[--slide:86%] lg:[--slide:80%] aspect-[16/10] sm:aspect-[16/8] lg:aspect-auto lg:h-[min(520px,42vw)]"

export default function PeekSlider() {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isRtl = i18n.dir() === "rtl"

  const { slides, isLoading, isError } = useActiveBanners()
  const count = slides.length
  const looping = count > 1

  // Three copies so both peeks always have a neighbour. `pos` indexes the
  // extended array and lives in the middle copy [count, 2*count) at rest; a
  // move steps it at most one slide outside, and `settle` snaps it back
  // without animation. Moves are locked while one is running, so it can
  // never run off the ends — the cause of the old blank frames.
  const extended = looping ? [...slides, ...slides, ...slides] : slides
  const [state, setState] = useState({ pos: 0, animate: false })
  const pos = looping && state.pos === 0 ? count : state.pos
  const current = count ? ((pos % count) + count) % count : 0

  const busyRef = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovered, setHovered] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const { pageHidden, reducedMotion } = usePlaybackBlockers()
  const [drag, setDrag] = useState<{ start: number; dx: number } | null>(null)

  const moveTo = useCallback(
    (target: number) => {
      if (!looping || busyRef.current) return
      busyRef.current = true
      setState({ pos: target, animate: true })
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => {
        busyRef.current = false
        setState((s) => {
          if (s.pos >= count * 2) return { pos: s.pos - count, animate: false }
          if (s.pos < count) return { pos: s.pos + count, animate: false }
          return { ...s, animate: false }
        })
      }, DURATION)
    },
    [looping, count]
  )

  const goNext = useCallback(() => moveTo(pos + 1), [moveTo, pos])
  const goPrev = useCallback(() => moveTo(pos - 1), [moveTo, pos])
  const goTo = (i: number) => i !== current && moveTo(count + i)

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])

  const autoplaying = looping && !hovered && !paused && !pageHidden && !reducedMotion && !drag

  useEffect(() => {
    if (!autoplaying) return
    const id = setTimeout(goNext, AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [autoplaying, goNext, pos])

  // Swipe / drag — the slide follows the finger, then snaps.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!looping || busyRef.current || (e.pointerType === "mouse" && e.button !== 0)) return
    setDrag({ start: e.clientX, dx: 0 })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    setDrag({ ...drag, dx: e.clientX - drag.start })
  }
  const onPointerUp = () => {
    if (!drag) return
    const { dx } = drag
    setDrag(null)
    // The track is always laid out LTR, so dragging left reveals the next slide.
    if (dx < -SWIPE_THRESHOLD) goNext()
    else if (dx > SWIPE_THRESHOLD) goPrev()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") (isRtl ? goPrev : goNext)()
    if (e.key === "ArrowLeft") (isRtl ? goNext : goPrev)()
  }

  const dragX = drag?.dx ?? 0
  const transition = state.animate && !drag

  if (isLoading) {
    return (
      <section className="pt-4">
        <div className={FRAME}>
          <div className="absolute inset-y-0 start-[calc((100%-var(--slide))/2)] w-(--slide) animate-pulse rounded-3xl bg-gray-200" />
        </div>
      </section>
    )
  }

  // Shoppers see the storefront, not a setup hint: no banners, no slider.
  if (isError || !count) return null

  return (
    <section
      className="pt-4"
      aria-roledescription="carousel"
      aria-label={t("banners", { defaultValue: "Banners" })}
    >
      <div
        className={`${FRAME} group touch-pan-y select-none outline-none`}
        style={{ "--primary": theme.palette.primary.main } as React.CSSProperties}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {/* dir="ltr" keeps the translate math identical for AR and EN. */}
        <div
          dir="ltr"
          className={`flex h-full ${looping ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            gap: GAP,
            transform: looping
              ? `translate3d(calc((100% - var(--slide)) / 2 - ${pos} * (var(--slide) + ${GAP}px) + ${dragX}px), 0, 0)`
              : `translate3d(calc((100% - var(--slide)) / 2), 0, 0)`,
            transition: transition ? `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {extended.map((slide, index) => {
            // Every copy of the current slide is styled active, so the silent
            // snap between copies changes nothing visible.
            const active = index % count === current
            const title = slide.title?.[i18n.language] || slide.title?.ar || slide.title?.en || ""
            return (
              <div
                key={`${slide._id}-${index}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${(index % count) + 1} / ${count}`}
                aria-hidden={!active || (looping && (index < count || index >= count * 2))}
                className="relative h-full shrink-0 basis-(--slide) overflow-hidden rounded-3xl bg-gray-100"
                style={{
                  transform: active ? "scale(1)" : "scale(0.94)",
                  transition: transition ? `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
                }}
              >
                {/* Shimmer until the image arrives, instead of an empty box. */}
                {!loaded[slide._id] && (
                  <div className="absolute inset-0 animate-pulse bg-linear-to-r from-gray-100 via-gray-200 to-gray-100" />
                )}
                <Image
                  src={getBackendUri(slide.image)}
                  alt={title}
                  fill
                  draggable={false}
                  priority={index % count === 0}
                  sizes="(min-width: 1024px) 80vw, 90vw"
                  onLoad={() => setLoaded((l) => (l[slide._id] ? l : { ...l, [slide._id]: true }))}
                  className={`pointer-events-none object-cover transition-opacity duration-500 ${
                    loaded[slide._id] ? "opacity-100" : "opacity-0"
                  }`}
                />
                {/* Side slides recede; a soft floor gradient keeps the controls legible. */}
                <div
                  className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-500"
                  style={{ opacity: active ? 0 : 0.35 }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/35 to-transparent" />
              </div>
            )
          })}
        </div>

        {looping && (
          <>
            {/* Arrows sit in the peeks; they point the way the slides travel in each direction. */}
            <button
              type="button"
              onClick={isRtl ? goNext : goPrev}
              aria-label={isRtl ? t("nextSlide", { defaultValue: "Next slide" }) : t("previousSlide", { defaultValue: "Previous slide" })}
              className={`${navButton} left-[max(12px,calc((100%-var(--slide))/2-24px))] opacity-0 group-hover:opacity-100`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={isRtl ? goPrev : goNext}
              aria-label={isRtl ? t("previousSlide", { defaultValue: "Previous slide" }) : t("nextSlide", { defaultValue: "Next slide" })}
              className={`${navButton} right-[max(12px,calc((100%-var(--slide))/2-24px))] opacity-0 group-hover:opacity-100`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <SliderIndicators
              ids={slides.map((s) => s._id)}
              current={current}
              progressKey={`${pos}-${autoplaying}`}
              autoplaying={autoplaying}
              paused={paused}
              onSelect={goTo}
              onTogglePause={() => setPaused((p) => !p)}
            />
          </>
        )}
      </div>
    </section>
  )
}
