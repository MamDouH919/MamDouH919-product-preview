"use client"

import { useSettingsQuery } from "@/backend-api/settings/hooks"
import { BannerStyle } from "@/backend-api/settings/types"
import PeekSlider from "./banner/PeekSlider"
import FadeSlider from "./banner/FadeSlider"

const SLIDERS: Record<BannerStyle, React.ComponentType> = {
  peek: PeekSlider,
  fade: FadeSlider,
}

/** The home page banners, in the slider style picked on the dashboard's Banners page. */
export default function BannerSlider() {
  const { data: settings, isLoading } = useSettingsQuery()
  if (isLoading) return null
  const Slider = SLIDERS[settings?.bannerStyle ?? "peek"] ?? PeekSlider
  return <Slider />
}
