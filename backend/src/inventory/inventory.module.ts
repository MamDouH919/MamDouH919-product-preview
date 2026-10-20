import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { StockMovement, StockMovementSchema } from './schemas/stock-movement.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { FinanceModule } from '../finance/finance.module';

/**
 * Registers the Product model itself rather than importing ProductsModule —
 * ProductsModule imports this one to log opening stock, and going both ways
 * would be circular. `tenantModelProvider` reuses whatever is already on the
 * connection, so registering the same model twice is harmless.
 */
@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    tenantModelProvider(StockMovement.name, StockMovementSchema),
    tenantModelProvider(Product.name, ProductSchema),
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
