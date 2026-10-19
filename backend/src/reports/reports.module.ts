import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(Review.name, ReviewSchema),
  ],
})
export class ReportsModule {}
