import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Category } from '../categories/schemas/category.schema';
import { Page } from '../pages/schemas/page.schema';

@Injectable()
export class SitemapService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Page.name) private pageModel: Model<Page>,
  ) {}

  /**
   * Every public URL's slug and last change — just enough for the storefront
   * to build `sitemap.xml`. Hidden products, inactive categories and draft
   * pages are left out, since a crawler would only find a 404 there.
   */
  async entries() {
    const [products, categories, pages] = await Promise.all([
      this.productModel
        .find({ isActive: true })
        .select('slug updatedAt images')
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
      this.categoryModel.find({ isActive: true }).select('slug updatedAt').lean().exec(),
      this.pageModel.find({ isPublished: true }).select('slug updatedAt').lean().exec(),
    ]);

    return {
      products: products.map((p: any) => ({
        slug: p.slug,
        updatedAt: p.updatedAt,
        image: p.images?.[0],
      })),
      categories: categories.map((c: any) => ({ slug: c.slug, updatedAt: c.updatedAt })),
      pages: pages.map((p: any) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    };
  }
}
