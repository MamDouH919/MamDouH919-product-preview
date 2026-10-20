import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { Courier, CourierSchema } from './schemas/courier.schema';
import { CourierSettlement, CourierSettlementSchema } from './schemas/courier-settlement.schema';
import { Payment, PaymentSchema } from '../finance/schemas/payment.schema';
import { Refund, RefundSchema } from '../refunds/schemas/refund.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { CouriersService } from './couriers.service';
import { CouriersController } from './couriers.controller';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [CouriersController],
  providers: [
    CouriersService,
    tenantModelProvider(Courier.name, CourierSchema),
    tenantModelProvider(CourierSettlement.name, CourierSettlementSchema),
    tenantModelProvider(Payment.name, PaymentSchema),
    tenantModelProvider(Refund.name, RefundSchema),
    tenantModelProvider(Counter.name, CounterSchema),
  ],
})
export class CouriersModule {}
