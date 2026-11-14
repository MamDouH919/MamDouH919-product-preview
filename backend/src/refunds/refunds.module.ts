import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { OnlinePaymentsModule } from '../online-payments/online-payments.module';
import { Payment, PaymentSchema } from '../finance/schemas/payment.schema';
import { ReturnsModule } from '../returns/returns.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { Refund, RefundSchema } from './schemas/refund.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { ReturnRequest, ReturnRequestSchema } from '../returns/schemas/return-request.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Courier, CourierSchema } from '../couriers/schemas/courier.schema';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';

@Module({
  imports: [AuthModule, InventoryModule, FinanceModule, ReturnsModule, OnlinePaymentsModule],
  controllers: [RefundsController],
  providers: [
    RefundsService,
    tenantModelProvider(Refund.name, RefundSchema),
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(ReturnRequest.name, ReturnRequestSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(Setting.name, SettingSchema),
    tenantModelProvider(Customer.name, CustomerSchema),
    // Read-only here: whether the caller is this store's super admin.
    tenantModelProvider(User.name, UserSchema),
    // Read-only here: the courier who pays a courier_cash refund.
    tenantModelProvider(Courier.name, CourierSchema),
    // Read-only here: the online payments a gateway refund goes back through.
    tenantModelProvider(Payment.name, PaymentSchema),
  ],
})
export class RefundsModule {}
