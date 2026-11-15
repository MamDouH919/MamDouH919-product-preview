import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../finance/schemas/payment.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { PaymentGatewaySetting, PaymentGatewaySettingSchema } from './schemas/payment-gateway-setting.schema';
import { PaymentAttempt, PaymentAttemptSchema } from './schemas/payment-attempt.schema';
import { GatewayPayout, GatewayPayoutSchema } from './schemas/gateway-payout.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { GatewayPayoutsService } from './gateway-payouts.service';
import { MailModule } from '../mail/mail.module';
import { OrderNotificationsService } from '../orders/order-notifications.service';
import { GatewaySettingsService } from './gateway-settings.service';
import { OnlinePaymentsService } from './online-payments.service';
import {
  GatewayPayoutsController,
  GatewayRefundsController,
  GatewaySettingsController,
  OnlinePaymentsPublicController,
  OnlinePaymentsWebhookController,
} from './online-payments.controller';

@Module({
  imports: [AuthModule, FinanceModule, MailModule],
  controllers: [OnlinePaymentsPublicController, OnlinePaymentsWebhookController, GatewaySettingsController, GatewayRefundsController, GatewayPayoutsController],
  providers: [
    GatewaySettingsService,
    OnlinePaymentsService,
    GatewayPayoutsService,
    OrderNotificationsService,
    tenantModelProvider(GatewayPayout.name, GatewayPayoutSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(PaymentGatewaySetting.name, PaymentGatewaySettingSchema),
    tenantModelProvider(PaymentAttempt.name, PaymentAttemptSchema),
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(Payment.name, PaymentSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
  exports: [OnlinePaymentsService],
})
export class OnlinePaymentsModule {}
