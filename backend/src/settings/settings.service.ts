import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BannerStyle, Setting } from './schemas/setting.schema';
import { User } from '../auth/schemas/user.schema';
import { Order } from '../orders/schemas/order.schema';
import { CURRENCIES, DEFAULT_CURRENCY } from '../common/money/money';
import { isValidTimeZone } from '../common/helpers/time-zone';
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
    @InjectModel(Order.name) private orderModel: Model<Order>,
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
    // The books' start and lock dates are moved only by finance code, never
    // through this general form, which saves whatever fields it is sent. A
    // dotted key ("finance.goLiveAt") or an operator ("$set") would reach them
    // as an update path, so those go too.
    for (const key of Object.keys(dto)) {
      if (key === 'finance' || key.startsWith('$') || key.includes('.')) {
        delete (dto as Record<string, unknown>)[key];
      }
    }

    const current = await this.settingModel.findOne().exec();
    const isSuper = async () => !!(await this.userModel.findById(userId).select('isSuper').exec())?.isSuper;

    // This route takes a raw multipart body, so nothing upstream validated it.
    if (dto.currencyCode !== undefined || dto.timezone !== undefined) {
      if (!(await isSuper())) {
        throw new ForbiddenException('Only a super admin can change the currency or time zone');
      }
    }
    if (dto.currencyCode !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(CURRENCIES, dto.currencyCode)) {
        throw new BadRequestException(`Unsupported currency "${dto.currencyCode}"`);
      }
      // Every stored amount is in the store's currency; relabelling it would
      // silently turn existing orders into a different amount of money.
      const changing = dto.currencyCode !== (current?.currencyCode ?? DEFAULT_CURRENCY);
      if (changing && (await this.orderModel.exists({}))) {
        throw new BadRequestException('The currency cannot change once the store has orders');
      }
    }
    if (dto.timezone !== undefined && !isValidTimeZone(dto.timezone)) {
      throw new BadRequestException(`Unknown time zone "${dto.timezone}"`);
    }
    if (dto.bannerStyle !== undefined && !Object.values(BannerStyle).includes(dto.bannerStyle)) {
      throw new BadRequestException(`Unknown banner style "${dto.bannerStyle}"`);
    }
    if (dto.showPrices !== undefined) {
      if (!['true', 'false'].includes(String(dto.showPrices))) {
        throw new BadRequestException('showPrices must be true or false');
      }
      dto.showPrices = String(dto.showPrices) === 'true';
    }

    let seedCountry: string | undefined;
    if (dto.country !== undefined) {
      if (!(await isSuper())) throw new ForbiddenException('Only a super admin can change the country');
      if (!SUPPORTED_COUNTRIES.includes(dto.country)) {
        throw new BadRequestException(`Unsupported country "${dto.country}"`);
      }
      // Seed before saving, so the store never points at a country with no zones.
      if (dto.country !== current?.country || !(await this.priceListService.isSeeded(dto.country))) {
        seedCountry = dto.country;
      }
    }

    // Images before any write: a file that isn't a real image is refused here,
    // before the country's price list or the old logo has been touched.
    const newFiles: string[] = [];
    try {
      if (files.logo?.[0]) {
        dto.logo = toPublicPath(await compressImage(files.logo[0], { maxWidth: 400, quality: 90 }));
        newFiles.push(dto.logo);
      }
      if (files.favicon?.[0]) {
        dto.favicon = toPublicPath(await compressImage(files.favicon[0], { maxWidth: 256, quality: 90 }));
        newFiles.push(dto.favicon);
      }
    } catch (error) {
      await Promise.all([...newFiles.map(deleteFile), ...[...(files.logo ?? []), ...(files.favicon ?? [])].map((f) => deleteFile(toPublicPath(f.path)))]);
      throw error;
    }

    let setting: Setting | null;
    try {
      if (seedCountry) await this.priceListService.seedCountry(seedCountry);
      setting = await this.settingModel
        .findOneAndUpdate({}, dto, { returnDocument: 'after', upsert: true })
        .exec();
    } catch (error) {
      await Promise.all(newFiles.map(deleteFile));
      throw error;
    }

    // The old images go only once the settings no longer point at them.
    if (current?.logo && newFiles.includes(dto.logo!) && current.logo !== dto.logo) await deleteFile(current.logo);
    if (current?.favicon && newFiles.includes(dto.favicon!) && current.favicon !== dto.favicon) await deleteFile(current.favicon);

    return setting!;
  }
}
