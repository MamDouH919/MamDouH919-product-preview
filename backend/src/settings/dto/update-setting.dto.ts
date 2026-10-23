import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';
import { CURRENCIES } from '../../common/money/money';
import { SUPPORTED_COUNTRIES } from '../../price-list/data';
import { BannerStyle } from '../schemas/setting.schema';

export class SocialMediaItemDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

export class UpdateSettingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  siteTitle?: LocalizedFieldDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  siteDescription?: LocalizedFieldDto;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  favicon?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  landLine?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialMediaItemDto)
  socialMedia?: SocialMediaItemDto[];

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  currency?: LocalizedFieldDto;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRIES)
  country?: string;

  @IsOptional()
  @IsIn(Object.keys(CURRENCIES))
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  // Arrives as a form-data string; validated as a number, stored by Mongoose's cast.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  returnWindowDays?: number;

  @IsOptional()
  @IsIn(Object.values(BannerStyle))
  bannerStyle?: BannerStyle;

  // Arrives as the form-data string "true" or "false".
  @IsOptional()
  @IsIn([true, false, 'true', 'false'])
  showPrices?: boolean | 'true' | 'false';
}
