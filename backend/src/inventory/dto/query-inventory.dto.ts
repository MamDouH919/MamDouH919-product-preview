import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { MovementType } from '../enums/movement-type.enum';

export enum StockFilter {
  ALL = 'all',
  LOW = 'low',
  OUT = 'out',
  IN_STOCK = 'in_stock',
}

export class QueryInventoryDto {
  @ApiProperty({ required: false, enum: StockFilter })
  @IsOptional()
  @IsEnum(StockFilter)
  status?: StockFilter;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiProperty({ required: false, description: 'Matches product name or SKU' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryMovementsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @ApiProperty({
    required: false,
    description: 'Narrows to one variant of the product',
  })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ required: false, enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiProperty({ required: false, description: 'ISO date, inclusive' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date, inclusive' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number;
}
