"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Container } from "@mui/material"
import { animate, useInView, useReducedMotion } from "framer-motion"
import { AnimateIn, StaggerChild, StaggerGroup } from "@/components/Animate"
import { getBackendUri } from "@/utils/helperFunctions"
import { hasHtml, useHomeSection } from "./useHomeSection"

/**
 * Counts up to the number inside a value like "12,500+", "4.9" or "$3M",
 * keeping whatever text sits around it. Values with no number show as typed.
 */
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reducedMotion = useReducedMotion()

  const match = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/)
  const target = match ? parseFloat(match[2].replace(/,/g, "")) : 0
  const decimals = match?.[2].split(".")[1]?.length ?? 0
  const grouped = match?.[2].includes(",") ?? false
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!match || !inView || reducedMotion) return
    const controls = animate(0, target, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setCurrent,
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target, reducedMotion])

  if (!match) return <span ref={ref}>{value}</span>

  const shown = reducedMotion ? target : current
  const formatted = shown.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  })

  return (
    <span ref={ref} dir="ltr" className="tabular-nums">
      {match[1]}
      {formatted}
      {match[3]}
    </span>
  )
}

export default function StatsSection({ sectionName = "home-stats" }: { sectionName?: string }) {
  const { section, text, cssVars } = useHomeSection(sectionName)
  const items = (section?.highlights ?? []).filter((h) => h.value)
  if (!section || !items.length) return null

  const title = text(section.title)
  const description = text(section.description)
  const columns = items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"

  return (
    <section className="py-12 md:py-20" style={cssVars}>
      <Container>
        <div className="relative isolate mx-4 overflow-hidden rounded-[2.5rem] bg-gray-950 px-6 py-16 text-white md:px-14 md:py-24">
          {/* Background: optional photo, a masked grid and two glows in the theme colour */}
          {section.image && (
            <Image
              src={getBackendUri(section.image)}
              alt=""
              fill
              sizes="100vw"
              className="-z-10 object-cover opacity-20 mix-blend-luminosity"
            />
          )}
          <div
            className="absolute inset-0 -z-10 opacity-[0.07] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
            style={{
              backgroundImage:
                "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div className="absolute -top-40 -start-32 -z-10 h-96 w-96 rounded-full bg-(--primary) opacity-40 blur-[120px]" />
          <div className="absolute -bottom-48 -end-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-(--primary) opacity-25 blur-[140px]" />

          {(title || hasHtml(description)) && (
            <AnimateIn className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
              {title && (
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h2>
              )}
              {hasHtml(description) && (
                <div
                  className="mt-5 text-base leading-8 text-white/60 md:text-lg"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}
            </AnimateIn>
          )}

          <StaggerGroup className={`grid grid-cols-2 gap-4 md:gap-6 ${columns}`}>
            {items.map((item, i) => (
              <StaggerChild
                key={i}
                className="group relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-(--primary)/60 hover:bg-white/[0.07] md:p-8"
              >
                {/* Top edge lights up on hover */}
                <span className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-(--primary) to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                {item.image && (
                  <div className="relative mx-auto mb-5 h-14 w-14 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Image src={getBackendUri(item.image)} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                )}
                <div className="bg-linear-to-b from-white to-white/55 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-6xl">
                  <CountUp value={item.value} />
                </div>
                <p className="mt-3 text-sm font-medium text-white/60 md:text-base">{text(item.key)}</p>
              </StaggerChild>
            ))}
          </StaggerGroup>
        </div>
      </Container>
    </section>
  )
}
