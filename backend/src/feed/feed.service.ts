import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../products/schemas/product.schema';

@Injectable()
export class FeedService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  /**
   * Every product a shopper can open, with what a shopping feed needs and
   * nothing it doesn't — no costs, views or other internals. Prices and stock
   * are the stored ones; the storefront decides what to advertise from them.
   */
  async products() {
    const products = await this.productModel
      .find({ isActive: true })
      .select(
        'name description shortDescription images price compareAtPrice sku brand gtin slug variants._id variants.label variants.price variants.compareAtPrice variants.sku variants.gtin variants.color variants.size variants.stock trackStock stock allowBackorder category subCategory updatedAt',
      )
      .populate('category', 'name slug isActive googleProductCategory')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();

    // A product in a hidden category isn't browsable, so don't advertise it.
    return products.filter((p: any) => p.category?.isActive !== false);
  }
}
