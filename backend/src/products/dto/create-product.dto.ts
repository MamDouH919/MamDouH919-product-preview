import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ProductVariantDto {
  // Present when editing an existing variant; absent when adding a new one.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  // Money: never negative, whole piastres only.
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  // Honoured only for brand-new variants — the stock of an existing variant
  // can only change through the inventory ledger.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

export class CreateProductDto {
  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  name!: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  description?: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  shortDescription?: LocalizedFieldDto;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  // Money: never negative, whole piastres only.
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  category!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  subCategory?: string;

  // Empty means "generate it from the name"; anything else must already be a
  // clean URL segment — the server won't silently rewrite what the user typed.
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @ValidateIf((o) => o.slug !== '')
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug may only contain lowercase English letters, numbers and single hyphens (e.g. my-product)',
  })
  slug?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  // Opening stock. Accepted on create; ignored on update (use /inventory/adjust).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;
}
