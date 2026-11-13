import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { processMedia, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';

export const bannerImageStorage = tenantImageStorage('banners', { allowVideo: true });

export type BannerFiles = {
  image?: Express.Multer.File[];
  mobileImage?: Express.Multer.File[];
};

// Banners are shown much wider than other images, so they keep more pixels
// than the 1280px default: room for a 2x laptop screen and a 3x phone.
const DESKTOP_MAX_WIDTH = 2400;
const MOBILE_MAX_WIDTH = 1080;

@Injectable()
export class BannersService {
  constructor(@InjectModel(Banner.name) private bannerModel: Model<Banner>) {}

  async create(createBannerDto: CreateBannerDto, files: BannerFiles = {}): Promise<Banner> {
    const image = files.image?.[0];
    const mobileImage = files.mobileImage?.[0];
    if (image) {
      createBannerDto.image = toPublicPath(await processMedia(image, { maxWidth: DESKTOP_MAX_WIDTH }));
    }
    if (mobileImage) {
      createBannerDto.mobileImage = toPublicPath(await processMedia(mobileImage, { maxWidth: MOBILE_MAX_WIDTH }));
    } else if (!createBannerDto.mobileImage) {
      delete createBannerDto.mobileImage;
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

  async update(id: string, updateBannerDto: UpdateBannerDto, files: BannerFiles = {}): Promise<Banner> {
    const existing = await this.bannerModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Banner with id ${id} not found`);

    const image = files.image?.[0];
    const mobileImage = files.mobileImage?.[0];
    const unset: Record<string, 1> = {};

    if (image) {
      if (existing.image) await deleteFile(existing.image);
      updateBannerDto.image = toPublicPath(await processMedia(image, { maxWidth: DESKTOP_MAX_WIDTH }));
    }

    if (mobileImage) {
      if (existing.mobileImage) await deleteFile(existing.mobileImage);
      updateBannerDto.mobileImage = toPublicPath(await processMedia(mobileImage, { maxWidth: MOBILE_MAX_WIDTH }));
    } else if (updateBannerDto.mobileImage === '') {
      // An empty value removes the phone image; the slider falls back to the main one.
      if (existing.mobileImage) await deleteFile(existing.mobileImage);
      delete updateBannerDto.mobileImage;
      unset.mobileImage = 1;
    }

    const changes = Object.keys(unset).length ? { $set: updateBannerDto, $unset: unset } : updateBannerDto;
    return this.bannerModel
      .findByIdAndUpdate(id, changes, { returnDocument: 'after' })
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
