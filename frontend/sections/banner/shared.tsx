"use client"

import { useEffect, useRef, useState } from "react"
import { preload } from "react-dom"
import { getImageProps } from "next/image"
import { getBackendUri } from "@/utils/helperFunctions"
import type { Banner } from "@/backend-api/banners/types"
import { Pause, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useBannersQuery } from "@/backend-api/banners/hooks"

export const AUTOPLAY_MS = 6000
export const SWIPE_THRESHOLD = 50

export const navButton =
  "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] ring-1 ring-black/5 backdrop-blur transition-all duration-300 hover:scale-105 hover:bg-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 md:flex"

/**
 * A banner's image, art-directed: phones get `mobileImage` when there is one,
 * everything else gets `image`. A <picture> lets the browser download only
 * the one it shows. Fills its (positioned) parent like `<Image fill>`.
 * The phone image is used below 640px (Tailwind's `sm`).
 */
const VIDEO_URL = /\.(mp4|webm|mov)(\?.*)?$/i

export const isVideoUrl = (url?: string) => !!url && VIDEO_URL.test(url)

/** True below 640px (Tailwind's `sm`), where phones get the phone media. False until mounted. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isMobile
}

/** How long a slide stays up: a video's own length (max 30s), otherwise the normal time. */
export function slideDurationMs(slide: Banner, isMobile: boolean) {
  const url = isMobile && slide.mobileImage ? slide.mobileImage : slide.image
  const seconds = isMobile && slide.mobileImage ? slide.mobileDuration : slide.duration
  return isVideoUrl(url) && seconds && seconds > 0 ? Math.round(seconds * 1000) : AUTOPLAY_MS
}

/** Whether the media shown on this screen is a video. */
export function slideIsVideo(slide: Banner, isMobile: boolean) {
  return isVideoUrl(isMobile && slide.mobileImage ? slide.mobileImage : slide.image)
}

/**
 * Video banner: muted, inline, filling its parent. It restarts when its slide
 * becomes the current one and pauses while it is hidden. Only the first
 * slide downloads eagerly; the rest fetch just their metadata.
 */
function BannerVideo({
  slide,
  active,
  priority,
  className,
  style,
  onLoad,
}: {
  slide: Banner
  active?: boolean
  priority?: boolean
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
}) {
  const isMobile = useIsMobile()
  const ref = useRef<HTMLVideoElement>(null)
  // The first slide downloads at once; the others start 1.5s later, once it has
  // had the bandwidth, so they are ready by the time their turn comes.
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setWarm(true), 1500)
    return () => clearTimeout(id)
  }, [])
  const desktop = getBackendUri(slide.image)
  const src = isMobile && slide.mobileImage ? getBackendUri(slide.mobileImage) : desktop
  const box: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) {
      v.currentTime = 0
      v.play().catch(() => {})
    } else {
      v.pause()
    }
    // A video can finish loading before React attaches onLoadedData (server-rendered page).
    if (v.readyState >= 2) onLoad?.()
  }, [active, src]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isVideoUrl(src)) {
    // Mixed case (video on one screen size, photo on the other): show the photo.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" draggable={false} onLoad={onLoad} className={className} style={box} />
  }
  return (
    <video
      ref={ref}
      key={src}
      // #t=0.001 makes the browser paint the first frame, so a waiting slide isn't a black box.
      src={`${src}#t=0.001`}
      autoPlay={priority}
      muted
      loop
      playsInline
      preload={priority || warm || active ? "auto" : "metadata"}
      onLoadedData={onLoad}
      onCanPlay={onLoad}
      className={className}
      style={box}
    />
  )
}

export function BannerPicture({
  slide,
  alt,
  priority,
  sizes,
  mobileSizes,
  active,
  className,
  style,
  onLoad,
}: {
  slide: Banner
  alt: string
  priority?: boolean
  /** `sizes` for the laptop image. */
  sizes: string
  /** `sizes` for the phone image. */
  mobileSizes: string
  /** Whether this is the slide on show; a video only plays then. */
  active?: boolean
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
}) {
  if (VIDEO_URL.test(slide.image ?? "") || (slide.mobileImage && VIDEO_URL.test(slide.mobileImage))) {
    return <BannerVideo slide={slide} active={active} priority={priority} className={className} style={style} onLoad={onLoad} />
  }
  // The first banner is the page's LCP: fetched first, never lazily. (`priority`
  // is deprecated in Next 16, and getImageProps can't add the preload itself.)
  const common = { alt, fill: true, ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}) }
  const {
    props: { src: desktopSrc, srcSet: desktopSrcSet, sizes: desktopSizes },
  } = getImageProps({ ...common, src: getBackendUri(slide.image), sizes })
  const mobileSrc = slide.mobileImage ? getBackendUri(slide.mobileImage) : getBackendUri(slide.image)
  const { props: mobile } = getImageProps({ ...common, src: mobileSrc, sizes: mobileSizes })

  // <link rel="preload"> in the <head>, one per breakpoint, so the browser starts
  // on the image it will show before it parses the body. React hoists these and
  // drops duplicates, so the slider's copies of the same slide add nothing.
  if (priority) {
    preload(mobile.src, { as: "image", imageSrcSet: mobile.srcSet, imageSizes: mobile.sizes, media: "(max-width: 639px)", fetchPriority: "high" })
    preload(desktopSrc, { as: "image", imageSrcSet: desktopSrcSet, imageSizes: desktopSizes, media: "(min-width: 640px)", fetchPriority: "high" })
  }

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={desktopSrcSet} sizes={desktopSizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
      <img
        {...mobile}
        draggable={false}
        onLoad={onLoad}
        // A cached image can finish before React attaches onLoad; catch it here.
        ref={(el) => {
          if (el?.complete && el.naturalWidth) onLoad?.()
        }}
        className={className}
        style={{ ...mobile.style, ...style }}
      />
    </picture>
  )
}

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
  durationMs = AUTOPLAY_MS,
  paused,
  onSelect,
  onTogglePause,
}: {
  ids: string[]
  current: number
  /** Changes whenever the slide or autoplay changes, restarting the fill. */
  progressKey: string
  autoplaying: boolean
  /** How long the current slide stays up; the dot fills over this time. */
  durationMs?: number
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
                      ? { animation: `banner-progress ${durationMs}ms linear forwards` }
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
