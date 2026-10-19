"use client"

import { Container } from "@mui/material"
import { useTheme } from "@mui/material/styles"
import RecentlyViewed from "@/features/Product/RecentlyViewed"

/** Home page "recently viewed" — empty (and invisible) for a first-time visitor. */
export default function RecentlyViewedSection() {
  const theme = useTheme()
  return (
    <Container style={{ "--primary": theme.palette.primary.main } as React.CSSProperties}>
      <RecentlyViewed className="px-4 py-6" />
    </Container>
  )
}
