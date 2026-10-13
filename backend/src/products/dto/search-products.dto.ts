import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ProductSort {
  /** The admin's own ordering, newest first within it. */
  FEATURED = 'featured',
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

// Query strings arrive as text; these turn them into what the validators expect.
const toNumber = ({ value }: { value: unknown }) =>
  value === '' || value == null ? undefined : Number(value);
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;

export class SearchProductsDto {
  @ApiProperty({ required: false, description: 'Matches name (any language), tags or SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  subCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({ required: false, description: 'Only products that can be bought right now' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiProperty({ required: false, enum: ProductSort, default: ProductSort.FEATURED })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 24 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}
