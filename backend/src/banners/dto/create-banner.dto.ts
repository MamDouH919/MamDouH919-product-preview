import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

export class CreateBannerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  /** Send an empty string to remove the phone image. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mobileImage?: string;

  /** Video length in seconds; 0 for a photo. Videos are limited to 30 seconds. */
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30.5)
  duration?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30.5)
  mobileDuration?: number;

  @ApiProperty({ required: true })
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  title!: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  description?: LocalizedFieldDto;
}
