import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Section } from './schemas/section.schema';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';

export const sectionImageStorage = tenantImageStorage('sections');

function filesByField(files: Express.Multer.File[]) {
  const image = files.find((f) => f.fieldname === 'image');
  const highlightFiles: Record<number, Express.Multer.File> = {};
  const galleryFiles: Express.Multer.File[] = [];
  for (const f of files) {
    const highlightMatch = f.fieldname.match(/^highlightImages\[(\d+)\]$/);
    if (highlightMatch) {
      highlightFiles[parseInt(highlightMatch[1])] = f;
    } else if (f.fieldname === 'galleryImages') {
      galleryFiles.push(f);
    }
  }
  return { image, highlightFiles, galleryFiles };
}

@Injectable()
export class SectionsService {
  constructor(@InjectModel(Section.name) private sectionModel: Model<Section>) {}

  async create(createSectionDto: CreateSectionDto, files: Express.Multer.File[]): Promise<Section> {
    const { image, highlightFiles, galleryFiles } = filesByField(files);

    if (image) {
      const compressed = await compressImage(image);
      createSectionDto.image = toPublicPath(compressed);
    }

    if (createSectionDto.highlights) {
      for (const [i, file] of Object.entries(highlightFiles)) {
        const idx = parseInt(i);
        if (createSectionDto.highlights[idx]) {
          const compressed = await compressImage(file);
          (createSectionDto.highlights[idx] as any).image = toPublicPath(compressed);
        }
      }
    }

    if (galleryFiles.length > 0) {
      const existing = createSectionDto.gallery ?? [];
      const newPaths = await Promise.all(
        galleryFiles.map(async (f) => toPublicPath(await compressImage(f))),
      );
      createSectionDto.gallery = [...existing, ...newPaths];
    }

    const section = new this.sectionModel(createSectionDto);
    return section.save();
  }

  async findAll(): Promise<Section[]> {
    return this.sectionModel.find().exec();
  }

  async findOne(id: string): Promise<Section> {
    const section = await this.sectionModel.findById(id).exec();
    if (!section) {
      throw new NotFoundException(`Section with id ${id} not found`);
    }
    return section;
  }

  async findByName(sectionName: string): Promise<Section> {
    const section = await this.sectionModel.findOne({ sectionName }).exec();
    if (!section) {
      throw new NotFoundException(`Section "${sectionName}" not found`);
    }
    return section;
  }

  async update(id: string, updateSectionDto: UpdateSectionDto, files: Express.Multer.File[]): Promise<Section> {
    const existing = await this.sectionModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Section with id ${id} not found`);

    const { image, highlightFiles, galleryFiles } = filesByField(files);

    if (image) {
      if (existing.image) await deleteFile(existing.image);
      const compressed = await compressImage(image);
      updateSectionDto.image = toPublicPath(compressed);
    }

    if (updateSectionDto.highlights) {
      for (let idx = 0; idx < updateSectionDto.highlights.length; idx++) {
        const newFile = highlightFiles[idx];
        if (newFile) {
          const oldImage = existing.highlights?.[idx]?.image;
          if (oldImage) await deleteFile(oldImage);
          const compressed = await compressImage(newFile);
          (updateSectionDto.highlights[idx] as any).image = toPublicPath(compressed);
        } else if (existing?.highlights?.[idx]?.image) {
          (updateSectionDto.highlights[idx] as any).image = existing.highlights[idx].image;
        }
      }
    }

    if (galleryFiles.length > 0 || updateSectionDto.gallery !== undefined) {
      const keptGallery = updateSectionDto.gallery ?? [];
      const removedGallery = (existing.gallery ?? []).filter((g) => !keptGallery.includes(g));
      await Promise.all(removedGallery.map(deleteFile));

      const newPaths = await Promise.all(
        galleryFiles.map(async (f) => toPublicPath(await compressImage(f))),
      );
      updateSectionDto.gallery = [...keptGallery, ...newPaths];
    }

    return this.sectionModel
      .findByIdAndUpdate(id, updateSectionDto, { returnDocument: 'after' })
      .exec() as Promise<Section>;
  }

  async remove(id: string): Promise<Section> {
    const section = await this.sectionModel.findByIdAndDelete(id).exec();
    if (!section) {
      throw new NotFoundException(`Section with id ${id} not found`);
    }
    return section;
  }
}
