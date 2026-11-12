import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ERROR_STATUSES, type ErrorStatus } from '../../common/tenant/error-log-store';

export class QueryErrorsDto {
  @ApiPropertyOptional({ description: "A store's host, or `platform`" })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ enum: ERROR_STATUSES })
  @IsOptional()
  @IsIn(ERROR_STATUSES)
  status?: ErrorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(599)
  statusCode?: number;

  @ApiPropertyOptional({ description: 'Matches the message, route or error name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ErrorStatsQueryDto {
  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}

export class UpdateErrorDto {
  @ApiPropertyOptional({ enum: ERROR_STATUSES })
  @IsOptional()
  @IsIn(ERROR_STATUSES)
  status?: ErrorStatus;

  @ApiPropertyOptional({ description: 'Empty clears the note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
