import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Product } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';

export const productImageStorage = diskStorage({
  destination: './uploads/products',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

function buildSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  async create(createProductDto: CreateProductDto, files: Express.Multer.File[]): Promise<Product> {
    if (typeof (createProductDto as any).variants === 'string') {
      try { createProductDto.variants = JSON.parse((createProductDto as any).variants); }
      catch { createProductDto.variants = []; }
    }

    if (files.length > 0) {
      const compressed = await Promise.all(
        files.map(async (f) => toPublicPath(await compressImage(f))),
      );
      createProductDto.images = [...(createProductDto.images ?? []), ...compressed];
    }

    if (!createProductDto.slug) {
      const base = createProductDto.name.en ?? createProductDto.name.ar ?? 'product';
      createProductDto.slug = await this.uniqueSlug(buildSlug(base));
    }

    const product = new this.productModel(createProductDto);
    return product.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel
      .find()
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findActive(): Promise<Product[]> {
    return this.productModel
      .find({ isActive: true })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.productModel
      .find({ category: categoryId })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findBySubCategory(subCategoryId: string): Promise<Product[]> {
    return this.productModel
      .find({ subCategory: subCategoryId })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec();
    if (!product) throw new NotFoundException(`Product with id ${id} not found`);
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productModel
      .findOne({ slug })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec();
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, files: Express.Multer.File[]): Promise<Product> {
    if (typeof (updateProductDto as any).variants === 'string') {
      try { updateProductDto.variants = JSON.parse((updateProductDto as any).variants); }
      catch { updateProductDto.variants = []; }
    }

    const existing = await this.productModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Product with id ${id} not found`);

    // Delete images removed by the client (were in DB but not in the new kept list)
    const keptImages = updateProductDto.images ?? [];
    const removedImages = (existing.images ?? []).filter((img) => !keptImages.includes(img));
    await Promise.all(removedImages.map(deleteFile));

    if (files.length > 0) {
      const compressed = await Promise.all(
        files.map(async (f) => toPublicPath(await compressImage(f))),
      );
      updateProductDto.images = [...keptImages, ...compressed];
    }

    return this.productModel
      .findByIdAndUpdate(id, updateProductDto, { returnDocument: 'after' })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec() as Promise<Product>;
  }

  async remove(id: string): Promise<Product> {
    const product = await this.productModel.findByIdAndDelete(id).exec();
    if (!product) throw new NotFoundException(`Product with id ${id} not found`);
    return product;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let count = 0;
    while (await this.productModel.exists({ slug })) {
      count++;
      slug = `${base}-${count}`;
    }
    return slug;
  }
}
