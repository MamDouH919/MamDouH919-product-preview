import BannerSlider from "@/sections/BannerSlider";
import CategoriesSlider from "@/sections/CategoriesSlider";
import CtaSection from "@/sections/CtaSection";
import GallerySection from "@/sections/GallerySection";
import ProductsGrid from "@/sections/ProductsGrid";
import RecentlyViewedSection from "@/sections/RecentlyViewedSection";
import StatsSection from "@/sections/StatsSection";
import StorySection from "@/sections/StorySection";

export default function Home() {
  return (
    <main>
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
    </main>
  );
}
