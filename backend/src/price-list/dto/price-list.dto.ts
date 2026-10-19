import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDeliveryPriceDto {
  @ApiProperty()
  @IsMongoId()
  subZoneId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
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
  @IsNumber()
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
  @IsNumber()
  @Min(0)
  price!: number;
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
