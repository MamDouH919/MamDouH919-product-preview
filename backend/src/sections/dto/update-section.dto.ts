import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSectionDto } from './create-section.dto';

export class UpdateSectionDto extends PartialType(OmitType(CreateSectionDto, ['sectionName'] as const)) {}
