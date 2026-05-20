import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';

export const bannerImageStorage = diskStorage({
  destination: './uploads/banners',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

@Injectable()
export class BannersService {
  constructor(@InjectModel(Banner.name) private bannerModel: Model<Banner>) {}

  async create(createBannerDto: CreateBannerDto, file?: Express.Multer.File): Promise<Banner> {
    if (file) {
      const compressed = await compressImage(file);
      createBannerDto.image = toPublicPath(compressed);
    }
    const lastBanner = await this.bannerModel.findOne().sort({ weight: -1 }).exec();
    const banner = new this.bannerModel({
      ...createBannerDto,
      weight: (lastBanner?.weight ?? 0) + 1,
    });
    return banner.save();
  }

  async findAll(): Promise<Banner[]> {
    return this.bannerModel.find().sort({ weight: 1 }).exec();
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException(`Banner with id ${id} not found`);
    }
    return banner;
  }

  async update(id: string, updateBannerDto: UpdateBannerDto, file?: Express.Multer.File): Promise<Banner> {
    const existing = await this.bannerModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Banner with id ${id} not found`);

    if (file) {
      if (existing.image) await deleteFile(existing.image);
      const compressed = await compressImage(file);
      updateBannerDto.image = toPublicPath(compressed);
    }

    return this.bannerModel
      .findByIdAndUpdate(id, updateBannerDto, { returnDocument: 'after' })
      .exec() as Promise<Banner>;
  }

  async updateWeight(id: string, newWeight: number): Promise<Banner[]> {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException(`Banner with id ${id} not found`);
    }

    const allBanners = await this.bannerModel.find().sort({ weight: 1 }).exec();

    const filtered = allBanners.filter((b) => b._id.toString() !== id);

    const insertIndex = Math.max(0, Math.min(newWeight - 1, filtered.length));
    filtered.splice(insertIndex, 0, banner);

    const bulkOps = filtered.map((b, index) => ({
      updateOne: {
        filter: { _id: b._id },
        update: { weight: index + 1 },
      },
    }));
    await this.bannerModel.bulkWrite(bulkOps);

    return this.findAll();
  }

  async remove(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!banner) {
      throw new NotFoundException(`Banner with id ${id} not found`);
    }
    return banner;
  }
}
