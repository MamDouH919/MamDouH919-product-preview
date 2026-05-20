import BannerSlider from "@/sections/BannerSlider";
import CategoriesSlider from "@/sections/CategoriesSlider";
import ProductsGrid from "@/sections/ProductsGrid";

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
    </main>
  );
}
