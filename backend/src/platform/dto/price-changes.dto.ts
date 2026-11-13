import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PRICE_KINDS, PRICE_SOURCES, type PriceKind, type PriceSource } from '../../common/tenant/price-change-store';

export class QueryPriceChangesDto {
  @ApiPropertyOptional({ description: "A store's host" })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ enum: PRICE_KINDS })
  @IsOptional()
  @IsIn(PRICE_KINDS)
  kind?: PriceKind;

  @ApiPropertyOptional({ enum: PRICE_SOURCES })
  @IsOptional()
  @IsIn(PRICE_SOURCES)
  source?: PriceSource;

  @ApiPropertyOptional({ description: 'Matches the product name, variant or SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Changes from this moment on (ISO date)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'Changes up to this moment (ISO date)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PriceChangeSummaryQueryDto {
  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: "A store's host" })
  @IsOptional()
  @IsString()
  host?: string;
}
