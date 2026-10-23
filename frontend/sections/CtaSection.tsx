"use client"

import Image from "next/image"
import { Container } from "@mui/material"
import { ArrowRight } from "lucide-react"
import { AnimateIn, scaleIn } from "@/components/Animate"
import CustomLink from "@/components/CustomLink"
import { getBackendUri } from "@/utils/helperFunctions"
import { hasHtml, useHomeSection } from "./useHomeSection"

const BUTTON =
  "group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold transition-all duration-300 md:text-base"
// The first link is the main action; any others are quieter outlines.
const PRIMARY_BUTTON = `${BUTTON} bg-white text-gray-900 shadow-[0_15px_35px_-12px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]`
const SECONDARY_BUTTON = `${BUTTON} text-(--on-primary) ring-1 ring-inset ring-current/40 hover:bg-white/10`

function SectionLink({ url, className, children }: { url: string; className: string; children: React.ReactNode }) {
  // Links inside the store go through the locale-aware link; anything else opens in a new tab.
  if (url.startsWith("/")) {
    return <CustomLink href={url} className={className}>{children}</CustomLink>
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export default function CtaSection({ sectionName = "home-cta" }: { sectionName?: string }) {
  const { section, text, cssVars } = useHomeSection(sectionName)
  if (!section) return null

  const title = text(section.title)
  const description = text(section.description)
  const links = (section.links ?? []).filter((l) => l.url && text(l.label))
  if (!title) return null

  return (
    <section className="py-12 md:py-20" style={cssVars}>
      <Container>
        <AnimateIn variants={scaleIn} className="px-4">
          <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-(--primary) text-(--on-primary)">
            {/* Depth: a dark sweep, concentric rings and a soft highlight */}
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-white/10 via-transparent to-black/35" />
            <div className="pointer-events-none absolute -end-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full border border-current/15" />
            <div className="pointer-events-none absolute -end-24 -top-24 -z-10 h-[24rem] w-[24rem] rounded-full border border-current/20" />
            <div className="pointer-events-none absolute -end-8 -top-8 -z-10 h-[14rem] w-[14rem] rounded-full border border-current/25" />
            <div className="pointer-events-none absolute -bottom-32 -start-20 -z-10 h-80 w-80 rounded-full bg-white/20 blur-[100px]" />

            <div className={`grid items-center gap-10 px-6 py-14 md:px-16 md:py-20 ${section.image ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
              <div className={section.image ? "" : "mx-auto max-w-3xl text-center"}>
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl md:leading-[1.15]">
                  {title}
                </h2>
                {hasHtml(description) && (
                  <div
                    className="mt-5 text-base leading-8 opacity-80 md:text-lg"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
                {links.length > 0 && (
                  <div className={`mt-9 flex flex-wrap gap-3 ${section.image ? "" : "justify-center"}`}>
                    {links.map((link, i) => (
                      <SectionLink key={i} url={link.url} className={i === 0 ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
                        {text(link.label)}
                        {i === 0 && (
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                        )}
                      </SectionLink>
                    ))}
                  </div>
                )}
              </div>

              {section.image && (
                <div className="relative mx-auto aspect-square w-full max-w-sm">
                  <div className="absolute inset-0 rotate-6 rounded-[2rem] bg-white/15 transition-transform duration-700 rtl:-rotate-6" />
                  <div className="relative h-full w-full -rotate-3 overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-25px_rgba(0,0,0,0.55)] ring-4 ring-white/20 transition-transform duration-700 hover:rotate-0 rtl:rotate-3 rtl:hover:rotate-0">
                    <Image
                      src={getBackendUri(section.image)}
                      alt={title}
                      fill
                      sizes="(min-width: 1024px) 384px, 80vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </AnimateIn>
      </Container>
    </section>
  )
}
