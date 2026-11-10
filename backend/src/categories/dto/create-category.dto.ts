import { ApiProperty } from '@nestjs/swagger';
import { IsSlug } from '../../common/helpers/slug';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

export class CreateCategoryDto {
  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  name!: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  description?: LocalizedFieldDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  // Empty means "generate it from the name". Case and spaces are tidied
  // ("For Him" → for-him); any other character is refused.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  order?: number;

  // Google product taxonomy id or path, for shopping feeds. Empty clears it.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  googleProductCategory?: string;
}
