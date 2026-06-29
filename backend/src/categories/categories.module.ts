import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category, CategorySchema } from './schemas/category.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    tenantModelProvider(Category.name, CategorySchema),
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
