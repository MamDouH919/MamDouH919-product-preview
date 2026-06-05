import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

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
}
