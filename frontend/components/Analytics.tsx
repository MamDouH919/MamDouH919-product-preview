"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

// The IDs end up inside inline script; anything but the expected shape is dropped.
const GA_ID = /^G-[A-Z0-9]+$/
const PIXEL_ID = /^\d+$/

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/**
 * Google Analytics 4 and the Meta Pixel for the storefront, each only when the
 * store has an ID. Both load after the page is interactive, so they never hold
 * up its first paint:
 * - GA4 `afterInteractive`, early enough to count visits that leave quickly.
 *   It records client-side navigations itself (GA4 enhanced measurement,
 *   "page changes based on browser history events", on by default).
 * - The pixel `lazyOnload`, when the browser is idle. It only counts the
 *   first page itself, so later navigations are sent from here.
 */
export default function Analytics({ gaId, fbPixelId }: { gaId?: string; fbPixelId?: string }) {
  const ga = gaId && GA_ID.test(gaId) ? gaId : undefined
  const pixel = fbPixelId && PIXEL_ID.test(fbPixelId) ? fbPixelId : undefined

  const pathname = usePathname()
  const firstPath = useRef(pathname)
  useEffect(() => {
    // The first page view is the snippet's own `fbq('track', 'PageView')`.
    if (!pixel || pathname === firstPath.current) return
    firstPath.current = ""
    window.fbq?.("track", "PageView")
  }, [pixel, pathname])

  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {pixel && (
        <>
          <Script id="meta-pixel" strategy="lazyOnload">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1`} />
          </noscript>
        </>
      )}
    </>
  )
}
