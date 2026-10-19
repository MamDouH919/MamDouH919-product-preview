import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';
import { PageBlockType, PageWidth } from '../schemas/page.schema';

export class PageBlockDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsEnum(PageBlockType)
  type!: PageBlockType;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsObject()
  style?: Record<string, any>;

  @IsObject()
  data!: Record<string, any>;
}

export class PageSettingsDto {
  @IsOptional()
  @IsEnum(PageWidth)
  maxWidth?: PageWidth;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  textColor?: string;

  @IsOptional()
  @IsBoolean()
  showTitle?: boolean;
}

export class CreatePageDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug!: string;

  @ApiProperty({ required: true })
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  title!: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  metaTitle?: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  metaDescription?: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  showInHeader?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  showInFooter?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSettingsDto)
  settings?: PageSettingsDto;

  @ApiProperty({ required: false, type: [PageBlockDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PageBlockDto)
  blocks?: PageBlockDto[];
}
