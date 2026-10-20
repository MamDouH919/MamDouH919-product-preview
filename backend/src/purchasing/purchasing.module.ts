import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { Supplier, SupplierSchema } from './schemas/supplier.schema';
import { Purchase, PurchaseSchema } from './schemas/purchase.schema';
import { PurchaseReturn, PurchaseReturnSchema } from './schemas/purchase-return.schema';
import { SupplierPayment, SupplierPaymentSchema } from './schemas/supplier-payment.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { PurchasingService } from './purchasing.service';
import { PurchasingController } from './purchasing.controller';

@Module({
  imports: [AuthModule, InventoryModule, FinanceModule],
  controllers: [PurchasingController],
  providers: [
    PurchasingService,
    tenantModelProvider(Supplier.name, SupplierSchema),
    tenantModelProvider(Purchase.name, PurchaseSchema),
    tenantModelProvider(PurchaseReturn.name, PurchaseReturnSchema),
    tenantModelProvider(SupplierPayment.name, SupplierPaymentSchema),
    tenantModelProvider(Product.name, ProductSchema),
    tenantModelProvider(Counter.name, CounterSchema),
  ],
})
export class PurchasingModule {}
