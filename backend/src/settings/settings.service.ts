import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from './schemas/setting.schema';
import { User } from '../auth/schemas/user.schema';
import { PriceListService } from '../price-list/price-list.service';
import { SUPPORTED_COUNTRIES } from '../price-list/data';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';

export const settingImageStorage = tenantImageStorage('settings');

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly priceListService: PriceListService,
  ) {}

  async get(): Promise<Setting> {
    let setting = await this.settingModel.findOne().exec();
    if (!setting) {
      setting = await this.settingModel.create({});
    }
    return setting;
  }

  async update(
    dto: UpdateSettingDto,
    files: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
    userId: string,
  ): Promise<Setting> {
    const current = await this.settingModel.findOne().exec();

    // This route takes a raw multipart body, so nothing upstream validated it.
    if (dto.country !== undefined) {
      const user = await this.userModel.findById(userId).select('isSuper').exec();
      if (!user?.isSuper) throw new ForbiddenException('Only a super admin can change the country');
      if (!SUPPORTED_COUNTRIES.includes(dto.country)) {
        throw new BadRequestException(`Unsupported country "${dto.country}"`);
      }
      // Seed before saving, so the store never points at a country with no zones.
      if (dto.country !== current?.country || !(await this.priceListService.isSeeded(dto.country))) {
        await this.priceListService.seedCountry(dto.country);
      }
    }

    if (files.logo?.[0]) {
      if (current?.logo) await deleteFile(current.logo);
      const compressed = await compressImage(files.logo[0], { maxWidth: 400, quality: 90 });
      dto.logo = toPublicPath(compressed);
    }
    if (files.favicon?.[0]) {
      if (current?.favicon) await deleteFile(current.favicon);
      dto.favicon = toPublicPath(files.favicon[0].path);
    }

    const setting = await this.settingModel
      .findOneAndUpdate({}, dto, { returnDocument: 'after', upsert: true })
      .exec();

    return setting!;
  }
}
