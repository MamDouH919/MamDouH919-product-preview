import BannerSlider from "@/sections/BannerSlider";
import CategoriesSlider from "@/sections/CategoriesSlider";
import ProductsGrid from "@/sections/ProductsGrid";
import RecentlyViewedSection from "@/sections/RecentlyViewedSection";

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
      <RecentlyViewedSection />
    </main>
  );
}
