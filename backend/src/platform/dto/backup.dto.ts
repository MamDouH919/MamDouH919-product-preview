import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RestoreBackupDto {
  @ApiPropertyOptional({ description: 'Only check the backup unless this is false', default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ description: "The store's host, typed by hand; required when dryRun is false" })
  @IsOptional()
  @IsString()
  confirm?: string;
}
