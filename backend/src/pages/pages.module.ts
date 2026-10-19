import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { Page, PageSchema } from './schemas/page.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [PagesController],
  providers: [
    PagesService,
    tenantModelProvider(Page.name, PageSchema),
  ],
})
export class PagesModule {}
