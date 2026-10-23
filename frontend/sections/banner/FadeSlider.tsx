"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import {
  AUTOPLAY_MS,
  SWIPE_THRESHOLD,
  navButton,
  SliderIndicators,
  useActiveBanners,
  usePlaybackBlockers,
} from "./shared"

const FADE_MS = 1000

// Edge to edge: the slide takes the whole width of the page.
export const FADE_FRAME =
  "relative w-full overflow-hidden aspect-[16/10] sm:aspect-[16/7] lg:aspect-auto lg:h-[min(560px,40vw)]"

/** Full-width banners stacked on top of each other; the current one fades in over the last. */
export default function FadeSlider() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.dir() === "rtl"

  const { slides, isLoading, isError } = useActiveBanners()
  const count = slides.length
  const looping = count > 1

  // `previous` keeps its zoom while it fades out underneath, so it doesn't snap back mid-fade.
  const [{ current, previous }, setShown] = useState({ current: 0, previous: -1 })
  // Bumped on every move so the progress fill restarts even when going back to the same slide.
  const [step, setStep] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [dragStart, setDragStart] = useState<number | null>(null)
  const { pageHidden, reducedMotion } = usePlaybackBlockers()

  // A banner switched off in the dashboard can shrink the list under us.
  const active = count ? current % count : 0

  const goTo = useCallback(
    (i: number) => {
      if (!looping) return
      setShown({ current: ((i % count) + count) % count, previous: active })
      setStep((s) => s + 1)
    },
    [looping, count, active]
  )
  const goNext = useCallback(() => goTo(active + 1), [goTo, active])
  const goPrev = useCallback(() => goTo(active - 1), [goTo, active])

  const autoplaying = looping && !hovered && !paused && !pageHidden && !reducedMotion && dragStart === null

  useEffect(() => {
    if (!autoplaying) return
    const id = setTimeout(goNext, AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [autoplaying, goNext, step])

  // Swipe: nothing slides with the finger in a fade, so only the release counts.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!looping || (e.pointerType === "mouse" && e.button !== 0)) return
    // Capturing the pointer would retarget the click away from the arrows and dots.
    if ((e.target as HTMLElement).closest("button")) return
    setDragStart(e.clientX)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart === null) return
    const dx = e.clientX - dragStart
    setDragStart(null)
    // Swiping towards the start edge brings the next slide, in either direction of reading.
    const towardsStart = isRtl ? dx > SWIPE_THRESHOLD : dx < -SWIPE_THRESHOLD
    const towardsEnd = isRtl ? dx < -SWIPE_THRESHOLD : dx > SWIPE_THRESHOLD
    if (towardsStart) goNext()
    else if (towardsEnd) goPrev()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") (isRtl ? goPrev : goNext)()
    if (e.key === "ArrowLeft") (isRtl ? goNext : goPrev)()
  }

  if (isLoading) {
    return (
      <section>
        <div className={`${FADE_FRAME} animate-pulse bg-gray-200`} />
      </section>
    )
  }

  if (isError || !count) return null

  const fade = reducedMotion ? "none" : `opacity ${FADE_MS}ms ease-in-out`

  return (
    <section aria-roledescription="carousel" aria-label={t("banners", { defaultValue: "Banners" })}>
      <div
        className={`${FADE_FRAME} group touch-pan-y select-none bg-gray-100 outline-none`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragStart(null)}
      >
        {slides.map((slide, index) => {
          const isActive = index === active
          const title = slide.title?.[i18n.language] || slide.title?.ar || slide.title?.en || ""
          return (
            <div
              key={slide._id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} / ${count}`}
              aria-hidden={!isActive}
              className="absolute inset-0"
              // The outgoing slide stays underneath at full opacity while the new one fades in on top,
              // so the frame never dips to the background colour mid-fade.
              style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 2 : 1, transition: fade }}
            >
              {!loaded[slide._id] && (
                <div className="absolute inset-0 animate-pulse bg-linear-to-r from-gray-100 via-gray-200 to-gray-100" />
              )}
              <Image
                src={getBackendUri(slide.image)}
                alt={title}
                fill
                draggable={false}
                priority={index === 0}
                sizes="100vw"
                onLoad={() => setLoaded((l) => (l[slide._id] ? l : { ...l, [slide._id]: true }))}
                // A slow push-in while the slide is showing; it holds with autoplay.
                className={`pointer-events-none object-cover transition-opacity duration-500 ${
                  loaded[slide._id] ? "opacity-100" : "opacity-0"
                }`}
                style={
                  !reducedMotion && (isActive || index === previous % count)
                    ? {
                        animation: `banner-zoom ${AUTOPLAY_MS + FADE_MS}ms linear forwards`,
                        animationPlayState: isActive && !autoplaying ? "paused" : "running",
                      }
                    : undefined
                }
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/35 to-transparent" />
            </div>
          )
        })}

        {looping && (
          <>
            <button
              type="button"
              onClick={isRtl ? goNext : goPrev}
              aria-label={isRtl ? t("nextSlide", { defaultValue: "Next slide" }) : t("previousSlide", { defaultValue: "Previous slide" })}
              className={`${navButton} left-4 opacity-0 group-hover:opacity-100 lg:left-8`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={isRtl ? goPrev : goNext}
              aria-label={isRtl ? t("previousSlide", { defaultValue: "Previous slide" }) : t("nextSlide", { defaultValue: "Next slide" })}
              className={`${navButton} right-4 opacity-0 group-hover:opacity-100 lg:right-8`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <SliderIndicators
              ids={slides.map((s) => s._id)}
              current={active}
              progressKey={`${step}-${autoplaying}`}
              autoplaying={autoplaying}
              paused={paused}
              onSelect={(i) => i !== active && goTo(i)}
              onTogglePause={() => setPaused((p) => !p)}
            />
          </>
        )}

        <style>{`@keyframes banner-zoom { from { transform: scale(1) } to { transform: scale(1.06) } }`}</style>
      </div>
    </section>
  )
}
