import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

export class CreateBannerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

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
