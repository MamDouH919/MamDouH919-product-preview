import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LocalizedFieldDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ar?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  en?: string;

}
