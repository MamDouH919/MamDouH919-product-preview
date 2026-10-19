import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';
import { SUPPORTED_COUNTRIES } from '../../price-list/data';

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

  // Arrives as a form-data string; validated as a number, stored by Mongoose's cast.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  returnWindowDays?: number;
}
