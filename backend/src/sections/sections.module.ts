import { Module } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { Section, SectionSchema } from './schemas/section.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [SectionsController],
  providers: [
    SectionsService,
    tenantModelProvider(Section.name, SectionSchema),
  ],
})
export class SectionsModule {}
