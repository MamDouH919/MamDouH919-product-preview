import { ApiProperty } from '@nestjs/swagger';
import { IsSlug } from '../../common/helpers/slug';
import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

export class CreateSubCategoryDto {
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

  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  category!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  order?: number;
}
