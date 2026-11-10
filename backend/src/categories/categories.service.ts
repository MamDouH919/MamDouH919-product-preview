import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';
import { buildSlug } from '../common/helpers/slug';

export const categoryImageStorage = tenantImageStorage('categories');


@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private categoryModel: Model<Category>) {}

  async create(createCategoryDto: CreateCategoryDto, file?: Express.Multer.File): Promise<Category> {
    if (file) {
      const compressed = await compressImage(file);
      createCategoryDto.image = toPublicPath(compressed);
    }

    if (!createCategoryDto.slug) {
      // Arabic letters strip out of a slug, so an Arabic-only name falls back to a plain word.
      createCategoryDto.slug = await this.uniqueSlug(
        buildSlug(createCategoryDto.name?.en ?? '') || buildSlug(createCategoryDto.name?.ar ?? '') || 'category',
      );
    }

    const category = new this.categoryModel(createCategoryDto);
    return category.save();
  }

  async findAll(): Promise<Category[]> {
    return this.categoryModel.find().sort({ order: 1, createdAt: -1 }).exec();
  }

  async findActive(): Promise<Category[]> {
    return this.categoryModel.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryModel.findOne({ slug }).exec();
    if (!category) {
      throw new NotFoundException(`Category "${slug}" not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, file?: Express.Multer.File): Promise<Category> {
    const existing = await this.categoryModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Category with id ${id} not found`);

    // A slug cleared to nothing keeps the current one; an empty slug can't be a link.
    if (updateCategoryDto.slug === '') delete updateCategoryDto.slug;

    if (file) {
      if (existing.image) await deleteFile(existing.image);
      const compressed = await compressImage(file);
      updateCategoryDto.image = toPublicPath(compressed);
    }

    return this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { returnDocument: 'after' })
      .exec() as Promise<Category>;
  }

  async remove(id: string): Promise<Category> {
    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let count = 0;
    while (await this.categoryModel.exists({ slug })) {
      count++;
      slug = `${base}-${count}`;
    }
    return slug;
  }
}
