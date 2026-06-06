import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from './schemas/setting.schema';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';

export const settingImageStorage = diskStorage({
  destination: './uploads/settings',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + (extname(file.originalname) || '.jpg'));
  },
});

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Setting.name) private settingModel: Model<Setting>) {}

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
  ): Promise<Setting> {
    const current = await this.settingModel.findOne().exec();

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
