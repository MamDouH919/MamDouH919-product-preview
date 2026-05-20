import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Category } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';

export const categoryImageStorage = diskStorage({
  destination: './uploads/categories',
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
export class CategoriesService {
  constructor(@InjectModel(Category.name) private categoryModel: Model<Category>) {}

  async create(createCategoryDto: CreateCategoryDto, file?: Express.Multer.File): Promise<Category> {
    if (file) {
      const compressed = await compressImage(file);
      createCategoryDto.image = toPublicPath(compressed);
    }

    if (!createCategoryDto.slug) {
      const base = createCategoryDto.name.en ?? createCategoryDto.name.ar ?? 'category';
      createCategoryDto.slug = await this.uniqueSlug(buildSlug(base));
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
