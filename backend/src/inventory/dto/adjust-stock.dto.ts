import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MANUAL_MOVEMENT_TYPES, MovementType } from '../enums/movement-type.enum';

export class AdjustStockDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false, description: 'Required when the product has variants' })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({
    enum: MANUAL_MOVEMENT_TYPES,
    description:
      'Only types an admin may record by hand. Sales, cancellations and opening stock are written by the system.',
  })
  @IsIn(MANUAL_MOVEMENT_TYPES, {
    message: `type must be one of: ${MANUAL_MOVEMENT_TYPES.join(', ')}`,
  })
  type!: MovementType;

  @ApiProperty({
    description:
      'Whole units, always positive. The movement type decides whether stock goes up or down.',
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class BulkAdjustStockDto {
  @ApiProperty({ type: [AdjustStockDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustStockDto)
  items!: AdjustStockDto[];
}

/**
 * A stock take: the admin reports what is physically on the shelf and the
 * service works out the delta. Safer than asking them to compute it.
 */
export class StockTakeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ description: 'Units actually counted', minimum: 0 })
  @IsInt()
  @Min(0)
  countedQuantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
