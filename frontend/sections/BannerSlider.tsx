"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, ImagePlus } from "lucide-react"
import { useBannersQuery } from "@/backend-api/banners/hooks"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import IconButton from "@mui/material/IconButton"
import Box from "@mui/material/Box"
import { useTheme, alpha } from "@mui/material/styles"

const GAP = 16

export default function BannerSlider() {
  const [isAutoPlay, setIsAutoPlay] = useState(true)
  // Initialize from the viewport width immediately so the first render is correct.
  // useLayoutEffect then refines to the actual element width (handles padding, max-width, etc.).
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.clientWidth : 0
  )

  // Relative index — 0 means "first real slide, middle copy".
  // The actual position in the extended array is always (trackIndex + realCount).
  // This avoids initializing state inside an effect.
  const [trackIndex, setTrackIndex] = useState(0)
  const [noTransition, setNoTransition] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const trackIndexRef = useRef(trackIndex)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  const { t, i18n } = useTranslation()
  const theme = useTheme()

  const { data, isLoading: loading, isError: error } = useBannersQuery()

  const slides = (data ?? [])
    .filter((b) => b.active)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  const realCount = slides.length
  // Extended array: [copy1, copy2, copy3] — we navigate copy2 (middle)
  const extended = realCount > 0 ? [...slides, ...slides, ...slides] : []

  // extendedIndex is the position inside the extended array
  const extendedIndex = trackIndex + realCount
  // Real (0-based) index for dots — handles negative trackIndex via double modulo
  const realCurrent = realCount > 0 ? ((trackIndex % realCount) + realCount) % realCount : 0

  // Keep ref in sync so handleTransitionEnd reads the latest value without stale closure
  useEffect(() => {
    trackIndexRef.current = trackIndex
  }, [trackIndex])

  // Measure container synchronously before paint to avoid first-render flash
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.offsetWidth)
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Autoplay
  useEffect(() => {
    if (!isAutoPlay || realCount === 0) return
    autoPlayRef.current = setInterval(() => {
      setTrackIndex((prev) => prev + 1)
    }, 5000)
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current) }
  }, [isAutoPlay, realCount])

  // After each CSS transition, silently jump back to the middle copy when needed
  const handleTransitionEnd = () => {
    const ti = trackIndexRef.current
    const ei = ti + realCount
    if (ei >= realCount * 2) {
      setNoTransition(true)
      setTrackIndex(ti - realCount)
    } else if (ei < realCount) {
      setNoTransition(true)
      setTrackIndex(ti + realCount)
    }
  }

  // Re-enable transition after the silent jump has been painted
  useEffect(() => {
    if (!noTransition) return
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setNoTransition(false))
    )
    return () => cancelAnimationFrame(id)
  }, [noTransition])

  const goNext = () => setTrackIndex((prev) => prev + 1)
  const goPrev = () => setTrackIndex((prev) => prev - 1)

  // Dot click: set trackIndex so extendedIndex lands on slide i in the middle copy
  const handleDotClick = (i: number) => setTrackIndex(i)

  const handleDragStart = (clientX: number) => {
    dragStartXRef.current = clientX
    isDraggingRef.current = true
  }

  const handleDragEnd = (clientX: number | null) => {
    if (!isDraggingRef.current || dragStartXRef.current === null) return
    const delta = (clientX ?? dragStartXRef.current) - dragStartXRef.current
    if (Math.abs(delta) > 50) {
      // Physical swipe direction matches LTR track: swipe right = prev, swipe left = next
      if (delta > 0) goPrev(); else goNext()
    }
    dragStartXRef.current = null
    isDraggingRef.current = false
  }

  // Peek layout — always LTR math; the track itself is forced to dir="ltr"
  const slideWidth = containerWidth * 0.82
  const peek = (containerWidth - slideWidth) / 2
  const translateX = peek - extendedIndex * (slideWidth + GAP)

  const heightClasses = "h-52 sm:h-64 md:h-80 lg:h-125"
  const wrapperClasses = `w-full  ${heightClasses}`

  if (loading) {
    return (
      <div className={`${wrapperClasses} overflow-hidden relative bg-gray-200 animate-pulse`}>
        <div className="absolute inset-0 bg-linear-to-r from-gray-200 via-gray-300 to-gray-200" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-gray-400/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!loading && (!realCount || error)) {
    return (
      <div className={`${wrapperClasses} overflow-hidden relative bg-gray-100 flex items-center justify-center`}>
        <div className="text-center text-gray-400">
          <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">{t("youCanAddBannersHere")}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-1" />
      <div
        ref={containerRef}
        className={`${wrapperClasses} overflow-hidden relative`}
        onMouseEnter={() => setIsAutoPlay(false)}
        onMouseLeave={() => setIsAutoPlay(true)}
      >
        {/* Slides track */}
        {/* dir="ltr" forces left-to-right flex layout regardless of page locale,
          so the translateX formula works identically for both AR and EN. */}
        <div
          dir="ltr"
          className="flex h-full"
          style={{
            gap: GAP,
            transform: `translateX(${translateX}px)`,
            transition: noTransition ? "none" : "transform 500ms ease-in-out",
          }}
          onTransitionEnd={handleTransitionEnd}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseUp={(e) => handleDragEnd(e.clientX)}
          onMouseLeave={() => handleDragEnd(null)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const touch = e.changedTouches[0]
            handleDragEnd(touch ? touch.clientX : null)
          }}
        >
          {extended.map((slide, index) => {
            const isActive = index === extendedIndex
            return (
              <div
                key={`${slide._id}-${index}`}
                className="shrink-0 h-full rounded-2xl overflow-hidden relative transition-[opacity,scale] duration-500"
                style={{
                  width: slideWidth || "82%",
                  opacity: isActive ? 1 : 0.5,
                  scale: isActive ? "1" : "0.97",
                }}
              >
                <div
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${getBackendUri(slide.image ?? "./placeholder.png")})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {/* <div className="absolute inset-0 bg-black/40" /> */}
                  {/* <div className="absolute inset-0 bg-linear-to-br from-black/60 via-black/30 to-transparent" /> */}
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop nav buttons */}
        <IconButton
          onClick={goPrev}
          aria-label="Previous slide"
          sx={{
            display: { xs: "none", md: "flex" },
            position: "absolute", left: 32, top: "50%", transform: "translateY(-50%)", zIndex: 20,
            bgcolor: "primary.main", color: "white", border: "1px solid", borderColor: "primary.main",
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <ChevronLeft size={24} />
        </IconButton>
        <IconButton
          onClick={goNext}
          aria-label="Next slide"
          sx={{
            display: { xs: "none", md: "flex" },
            position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", zIndex: 20,
            bgcolor: "primary.main", color: "white", border: "1px solid", borderColor: "primary.main",
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <ChevronRight size={24} />
        </IconButton>

        {/* Desktop dots */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
            zIndex: 20, gap: 1.5, alignItems: "center",
          }}
        >
          {slides.map((_, i) => (
            <Box
              key={i}
              component="button"
              onClick={() => handleDotClick(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === realCurrent}
              sx={{
                border: "1px solid", borderRadius: "9999px", cursor: "pointer", p: 0,
                transition: "all 0.3s", backdropFilter: "blur(4px)",
                ...(i === realCurrent
                  ? { width: 32, height: 8, bgcolor: "primary.main", borderColor: "primary.main" }
                  : { width: 8, height: 8, bgcolor: alpha(theme.palette.primary.main, 0.3), borderColor: alpha(theme.palette.primary.main, 0.3), "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.6) } }
                ),
              }}
            />
          ))}
        </Box>

        {/* Mobile nav + dots */}
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            position: "absolute", bottom: 24, left: 0, right: 0,
            zIndex: 20, alignItems: "center", gap: 2, px: 2,
          }}
        >
          <IconButton
            onClick={goPrev}
            aria-label="Previous slide"
            size="small"
            sx={{ bgcolor: "primary.main", color: "white", border: "1px solid", borderColor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}
          >
            {i18n.dir() === "rtl" ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </IconButton>

          <Box sx={{ flex: 1, display: "flex", justifyContent: "center", gap: 1.5, alignItems: "center" }}>
            {slides.map((_, i) => (
              <Box
                key={i}
                component="button"
                onClick={() => handleDotClick(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === realCurrent}
                sx={{
                  border: "1px solid", borderRadius: "9999px", cursor: "pointer", p: 0,
                  transition: "all 0.3s",
                  ...(i === realCurrent
                    ? { width: 32, height: 8, bgcolor: "primary.main", borderColor: "primary.main" }
                    : { width: 8, height: 8, bgcolor: alpha(theme.palette.primary.main, 0.3), borderColor: alpha(theme.palette.primary.main, 0.3), "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.6) } }
                  ),
                }}
              />
            ))}
          </Box>

          <IconButton
            onClick={goNext}
            aria-label="Next slide"
            size="small"
            sx={{ bgcolor: "primary.main", color: "white", border: "1px solid", borderColor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}
          >
            {i18n.dir() === "rtl" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </IconButton>
        </Box>
      </div>
    </>
  )
}
