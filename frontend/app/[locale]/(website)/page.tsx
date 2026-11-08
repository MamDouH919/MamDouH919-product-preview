import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Prefetched } from "@/lib/prefetch";
import { JsonLd, storeContext, storeLd } from "@/lib/jsonLd";
import { BANNERS_QUERY_KEY } from "@/backend-api/banners/hooks";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { SECTIONS_QUERY_KEY } from "@/backend-api/sections/hooks";
import BannerSlider from "@/sections/BannerSlider";
import CategoriesSlider from "@/sections/CategoriesSlider";
import CtaSection from "@/sections/CtaSection";
import GallerySection from "@/sections/GallerySection";
import ProductsGrid from "@/sections/ProductsGrid";
import RecentlyViewedSection from "@/sections/RecentlyViewedSection";
import StatsSection from "@/sections/StatsSection";
import StorySection from "@/sections/StorySection";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  // The store's own title and description, plus the canonical and hreflang the layout can't know.
  return pageMetadata({ locale, path: "" });
}

/** Each section's default name; a section that doesn't exist yet is simply skipped. */
const HOME_SECTIONS = ["home-story", "home-stats", "home-gallery", "home-cta"];

const HOME = [
  { key: [BANNERS_QUERY_KEY], path: "/banners" },
  // ProductsGrid: useProductsQuery() with no filters.
  { key: [PRODUCTS_QUERY_KEY, undefined], path: "/products" },
  ...HOME_SECTIONS.map((name) => ({ key: [SECTIONS_QUERY_KEY, "name", name], path: `/sections/name/${name}` })),
];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [{ tenant }, ld] = await Promise.all([storeContext(), storeLd(locale)]);

  // The layout already wraps every page in <main>; a second one confuses screen readers and crawlers.
  return (
    <Prefetched entries={HOME}>
      <JsonLd data={ld} />
      {/* The page's subject for search engines and screen readers; the banner carries it visually. */}
      <h1 className="sr-only">{tenant[locale === "ar" ? "ar" : "en"].title}</h1>
      <BannerSlider />
      <section className="py-6">
        <CategoriesSlider />
      </section>
      <section className="py-6">
        <ProductsGrid />
      </section>
      {/* Content sections from the dashboard (Sections); each hides itself until it's created. */}
      <StorySection />
      <StatsSection />
      <GallerySection />
      <CtaSection />
      <RecentlyViewedSection />
    </Prefetched>
  );
}
