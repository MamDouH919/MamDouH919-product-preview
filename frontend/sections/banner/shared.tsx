"use client"

import { useEffect, useState } from "react"
import { Pause, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useBannersQuery } from "@/backend-api/banners/hooks"

export const AUTOPLAY_MS = 6000
export const SWIPE_THRESHOLD = 50

export const navButton =
  "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] ring-1 ring-black/5 backdrop-blur transition-all duration-300 hover:scale-105 hover:bg-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 md:flex"

/** Active banners, heaviest first — the order the dashboard list shows. */
export function useActiveBanners() {
  const { data, isLoading, isError } = useBannersQuery()
  const slides = (data ?? [])
    .filter((b) => b.active)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  return { slides, isLoading, isError }
}

/**
 * Whether autoplay should hold for reasons outside the slider: a background
 * tab (timers throttle and transitions skip there) or a reduced-motion setting.
 */
export function usePlaybackBlockers() {
  const [pageHidden, setPageHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMotion = () => setReducedMotion(motion.matches)
    onMotion()
    motion.addEventListener("change", onMotion)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      motion.removeEventListener("change", onMotion)
    }
  }, [])

  return { pageHidden, reducedMotion }
}

/** Dots plus play/pause; the active dot fills over the autoplay interval. */
export function SliderIndicators({
  ids,
  current,
  progressKey,
  autoplaying,
  paused,
  onSelect,
  onTogglePause,
}: {
  ids: string[]
  current: number
  /** Changes whenever the slide or autoplay changes, restarting the fill. */
  progressKey: string
  autoplaying: boolean
  paused: boolean
  onSelect: (index: number) => void
  onTogglePause: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/25 p-1.5 ps-3 backdrop-blur-md sm:bottom-6">
      <div className="flex items-center gap-1.5">
        {ids.map((id, i) => {
          const active = i === current
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`${t("goToSlide", { defaultValue: "Go to slide" })} ${i + 1}`}
              aria-current={active}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-500 ${
                active ? "w-8 bg-white/40" : "w-1.5 bg-white/60 hover:bg-white"
              }`}
            >
              {active && (
                <span
                  key={progressKey}
                  className="absolute inset-y-0 start-0 rounded-full bg-white"
                  style={
                    autoplaying
                      ? { animation: `banner-progress ${AUTOPLAY_MS}ms linear forwards` }
                      : { width: "100%" }
                  }
                />
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? t("play", { defaultValue: "Play" }) : t("pause", { defaultValue: "Pause" })}
        className="ms-1 flex h-6 w-6 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20"
      >
        {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
      </button>
      <style>{`@keyframes banner-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  )
}
