import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';
import { SectionType } from '../schemas/section.schema';

export class LinkItemDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  label?: LocalizedFieldDto;

  @IsString()
  url!: string;
}

export class HighlightItemDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  key?: LocalizedFieldDto;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class CreateSectionDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  sectionName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  title?: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  description?: LocalizedFieldDto;

  @ApiProperty({ enum: SectionType, required: false })
  @IsOptional()
  @IsEnum(SectionType)
  type?: SectionType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightItemDto)
  highlights?: HighlightItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkItemDto)
  links?: LinkItemDto[];
}
