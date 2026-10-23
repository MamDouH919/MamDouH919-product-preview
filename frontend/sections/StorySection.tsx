"use client"

import Image from "next/image"
import { Container } from "@mui/material"
import { AnimateIn, fadeLeft, fadeRight } from "@/components/Animate"
import { getBackendUri } from "@/utils/helperFunctions"
import { hasHtml, useHomeSection } from "./useHomeSection"

// Rich text from the dashboard editor, styled for a large intro block:
// list items get a check badge in the theme colour instead of a bullet.
const PROSE =
  "text-base md:text-lg leading-8 text-gray-600 [&_p]:mb-4 [&_strong]:text-gray-900 " +
  "[&_ul]:mt-6 [&_ul]:grid [&_ul]:gap-3 [&_li]:relative [&_li]:ps-10 [&_li]:font-medium [&_li]:text-gray-800 " +
  "[&_li]:before:absolute [&_li]:before:start-0 [&_li]:before:top-1 [&_li]:before:flex [&_li]:before:h-6 [&_li]:before:w-6 " +
  "[&_li]:before:items-center [&_li]:before:justify-center [&_li]:before:rounded-full [&_li]:before:bg-(--primary)/10 " +
  "[&_li]:before:text-xs [&_li]:before:font-black [&_li]:before:text-(--primary) [&_li]:before:content-['✓']"

export default function StorySection({ sectionName = "home-story" }: { sectionName?: string }) {
  const { section, text, cssVars, isRtl } = useHomeSection(sectionName)
  if (!section) return null

  const title = text(section.title)
  const description = text(section.description)
  if (!title && !section.image) return null

  return (
    <section className="py-12 md:py-20 overflow-hidden" style={cssVars}>
      <Container>
        <div className="grid items-center gap-14 px-4 lg:grid-cols-2 lg:gap-20">
          {section.image && (
            <AnimateIn variants={isRtl ? fadeRight : fadeLeft} className="relative mx-auto w-full max-w-md lg:max-w-none">
              {/* Offset tinted frame behind the photo */}
              <div className="absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-[2.5rem] bg-(--primary)/15 rtl:-translate-x-4 rtl:-rotate-3" />
              {/* Dot grid peeking out of the top corner */}
              <div
                className="absolute -top-8 -start-8 h-32 w-32 text-(--primary) opacity-40"
                style={{ backgroundImage: "radial-gradient(currentColor 2px, transparent 2px)", backgroundSize: "16px 16px" }}
              />
              <div className="group relative aspect-4/5 overflow-hidden rounded-[2.5rem] bg-gray-100 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)]">
                <Image
                  src={getBackendUri(section.image)}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  className="object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
              </div>
              {/* Slow-spinning dashed ring overlapping the bottom corner */}
              <div className="absolute -bottom-10 -end-6 flex h-28 w-28 items-center justify-center md:h-36 md:w-36">
                <div className="absolute inset-0 animate-[spin_18s_linear_infinite] rounded-full border-2 border-dashed border-(--primary)/60 motion-reduce:animate-none" />
                <div className="h-16 w-16 rounded-full bg-(--primary) shadow-[0_20px_40px_-12px_var(--primary)] md:h-20 md:w-20" />
              </div>
            </AnimateIn>
          )}

          <AnimateIn variants={isRtl ? fadeLeft : fadeRight} className={section.image ? "" : "lg:col-span-2 mx-auto max-w-3xl text-center"}>
            <span className="mb-5 block h-1.5 w-14 rounded-full bg-linear-to-r from-(--primary) to-(--primary)/30 rtl:bg-linear-to-l" />
            {title && (
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl md:leading-[1.15]">
                {title}
              </h2>
            )}
            {hasHtml(description) && (
              <div className={`mt-6 ${PROSE}`} dangerouslySetInnerHTML={{ __html: description }} />
            )}
          </AnimateIn>
        </div>
      </Container>
    </section>
  )
}
