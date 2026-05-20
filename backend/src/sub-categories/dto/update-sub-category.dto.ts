import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSubCategoryDto } from './create-sub-category.dto';

export class UpdateSubCategoryDto extends PartialType(OmitType(CreateSubCategoryDto, ['category'] as const)) {}
