import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

/** Prices one or more subzones at the same price; none of them may be priced yet. */
export class CreateDeliveryPriceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsMongoId({ each: true })
  subZoneIds!: string[];

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** The subzone is fixed once priced — delete the row to move it. */
export class UpdateDeliveryPriceDto {
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Prices every subzone of a zone at once; rows that exist get the new price. */
export class SetZonePriceDto {
  @ApiProperty()
  @IsMongoId()
  zoneId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}

/** One price for every area; null switches back to the per-area price list. */
export class SetFlatPriceDto {
  @ApiProperty({ minimum: 0, nullable: true, type: Number })
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number | null;
}

export class QueryDeliveryPricesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  zone?: string;

  @ApiProperty({ required: false, description: 'Matches the subzone name' })
  @IsOptional()
  @IsString()
  search?: string;
}
