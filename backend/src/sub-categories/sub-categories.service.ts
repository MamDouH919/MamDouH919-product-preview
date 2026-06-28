import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubCategory } from './schemas/sub-category.schema';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';

export const subCategoryImageStorage = tenantImageStorage('sub-categories');

function buildSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

@Injectable()
export class SubCategoriesService {
  constructor(@InjectModel(SubCategory.name) private subCategoryModel: Model<SubCategory>) {}

  async create(createSubCategoryDto: CreateSubCategoryDto, file?: Express.Multer.File): Promise<SubCategory> {
    if (file) {
      const compressed = await compressImage(file);
      createSubCategoryDto.image = toPublicPath(compressed);
    }

    if (!createSubCategoryDto.slug) {
      const base = createSubCategoryDto.name.en ?? createSubCategoryDto.name.ar ?? 'sub-category';
      createSubCategoryDto.slug = await this.uniqueSlug(buildSlug(base));
    }

    const subCategory = new this.subCategoryModel(createSubCategoryDto);
    return subCategory.save();
  }

  async findAll(): Promise<SubCategory[]> {
    return this.subCategoryModel
      .find()
      .populate('category', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findByCategory(categoryId: string): Promise<SubCategory[]> {
    return this.subCategoryModel
      .find({ category: categoryId })
      .populate('category', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findActive(): Promise<SubCategory[]> {
    return this.subCategoryModel
      .find({ isActive: true })
      .populate('category', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<SubCategory> {
    const subCategory = await this.subCategoryModel
      .findById(id)
      .populate('category', 'name slug')
      .exec();
    if (!subCategory) {
      throw new NotFoundException(`SubCategory with id ${id} not found`);
    }
    return subCategory;
  }

  async findBySlug(slug: string): Promise<SubCategory> {
    const subCategory = await this.subCategoryModel
      .findOne({ slug })
      .populate('category', 'name slug')
      .exec();
    if (!subCategory) {
      throw new NotFoundException(`SubCategory "${slug}" not found`);
    }
    return subCategory;
  }

  async update(id: string, updateSubCategoryDto: UpdateSubCategoryDto, file?: Express.Multer.File): Promise<SubCategory> {
    const existing = await this.subCategoryModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`SubCategory with id ${id} not found`);

    if (file) {
      if (existing.image) await deleteFile(existing.image);
      const compressed = await compressImage(file);
      updateSubCategoryDto.image = toPublicPath(compressed);
    }

    return this.subCategoryModel
      .findByIdAndUpdate(id, updateSubCategoryDto, { returnDocument: 'after' })
      .populate('category', 'name slug')
      .exec() as Promise<SubCategory>;
  }

  async remove(id: string): Promise<SubCategory> {
    const subCategory = await this.subCategoryModel.findByIdAndDelete(id).exec();
    if (!subCategory) {
      throw new NotFoundException(`SubCategory with id ${id} not found`);
    }
    return subCategory;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let count = 0;
    while (await this.subCategoryModel.exists({ slug })) {
      count++;
      slug = `${base}-${count}`;
    }
    return slug;
  }
}
