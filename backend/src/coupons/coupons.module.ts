import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { CouponUsage, CouponUsageSchema } from './schemas/coupon-usage.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [CouponsController],
  providers: [
    CouponsService,
    tenantModelProvider(Coupon.name, CouponSchema),
    // Read-only here: counting a customer's past uses of a code.
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(CouponUsage.name, CouponUsageSchema),
  ],
  exports: [CouponsService],
})
export class CouponsModule {}
