"use client"

import { Container } from "@mui/material"
import { ChevronDown } from "lucide-react"
import { hasHtml, useHomeSection } from "./useHomeSection"

/**
 * Questions and answers from the dashboard (an FAQ section). Each answer sits in
 * a closed <details>: collapsed on screen, yet in the HTML for search engines.
 * The page publishes the same items as FAQPage structured data (see faqLd).
 */
export default function FaqSection({ sectionName = "home-faq" }: { sectionName?: string }) {
  const { section, text, html, cssVars } = useHomeSection(sectionName)
  if (!section) return null

  const items = (section.faqs ?? [])
    .map((f) => ({ question: text(f.question).trim(), answer: text(f.answer).trim() }))
    .filter((f) => f.question && f.answer)
  if (!items.length) return null

  const title = text(section.title)
  const intro = html(section.description)

  return (
    <section className="py-12 md:py-16" style={cssVars}>
      <Container>
        <div className="mx-auto max-w-3xl px-4">
          {title && (
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{title}</h2>
          )}
          {hasHtml(intro) && (
            <div
              className="mx-auto mt-4 max-w-2xl text-center text-base leading-7 text-gray-600 [&_p]:mb-3"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}

          <div className="mt-8 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {items.map((item, i) => (
              <details key={i} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-(--primary)">
                  <h3 className="text-base font-semibold text-gray-900 md:text-lg">{item.question}</h3>
                  <ChevronDown
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-(--primary) transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600 md:text-base">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
