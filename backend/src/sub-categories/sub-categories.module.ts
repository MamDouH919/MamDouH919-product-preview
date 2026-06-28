import { Module } from '@nestjs/common';
import { SubCategoriesService } from './sub-categories.service';
import { SubCategoriesController } from './sub-categories.controller';
import { SubCategory, SubCategorySchema } from './schemas/sub-category.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [SubCategoriesController],
  providers: [
    SubCategoriesService,
    tenantModelProvider(SubCategory.name, SubCategorySchema),
  ],
  exports: [SubCategoriesService],
})
export class SubCategoriesModule {}
