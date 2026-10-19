import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const DASHBOARD_PERIODS = ['7', '30', '90'] as const;

export class DashboardQueryDto {
  @ApiProperty({ required: false, enum: DASHBOARD_PERIODS, default: '30' })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  days?: (typeof DASHBOARD_PERIODS)[number];

  /** IANA zone of the viewer, e.g. "Africa/Cairo" — decides where a day starts. */
  @ApiProperty({ required: false, example: 'Africa/Cairo' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
