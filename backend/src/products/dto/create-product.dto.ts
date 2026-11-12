import { ApiProperty } from '@nestjs/swagger';
import { IsSlug } from '../../common/helpers/slug';
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

/** Units a new product or variant starts with in one warehouse. */
export class OpeningStockDto {
  @ApiProperty()
  @IsMongoId()
  warehouseId!: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity!: number;
}

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

  // The price before a discount; null clears it.
  @ApiProperty({ required: false, minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number | null;

  // EAN-8, UPC-12, EAN-13 or GTIN-14. Empty clears it.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.gtin !== '')
  @Matches(/^(\d{8}|\d{12,14})$/, { message: 'gtin must be an 8, 12, 13 or 14 digit barcode' })
  gtin?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  size?: string;

  // Honoured only for brand-new variants — the stock of an existing variant
  // can only change through the inventory ledger.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  // Cost of one opening unit. Same rule as `stock`: new variants only.
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  // Opening stock split by warehouse. When given it replaces `stock`.
  @ApiProperty({ required: false, type: [OpeningStockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningStockDto)
  openingStocks?: OpeningStockDto[];
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

  // The price before a discount; null clears it.
  @ApiProperty({ required: false, minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  // EAN-8, UPC-12, EAN-13 or GTIN-14. Empty clears it.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.gtin !== '')
  @Matches(/^(\d{8}|\d{12,14})$/, { message: 'gtin must be an 8, 12, 13 or 14 digit barcode' })
  gtin?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  category!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  subCategory?: string;

  // Empty means "generate it from the name". Case and spaces are tidied
  // ("Candy perfume" → candy-perfume); any other character is refused.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsSlug()
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

  // Cost of one opening unit, booked with the opening stock. Create only;
  // after that, costs come from purchases.
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  // Opening stock split by warehouse. When given it replaces `stock`.
  @ApiProperty({ required: false, type: [OpeningStockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningStockDto)
  openingStocks?: OpeningStockDto[];

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
