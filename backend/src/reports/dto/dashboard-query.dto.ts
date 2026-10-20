import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const DASHBOARD_PERIODS = ['7', '30', '90'] as const;

export class DashboardQueryDto {
  @ApiProperty({ required: false, enum: DASHBOARD_PERIODS, default: '30' })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  days?: (typeof DASHBOARD_PERIODS)[number];

  /**
   * Ignored: days now start at midnight in the store's own zone (Settings →
   * time zone), so two viewers in different zones see the same figures.
   * Still accepted so older dashboards keep working.
   */
  @ApiProperty({ required: false, example: 'Africa/Cairo' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
