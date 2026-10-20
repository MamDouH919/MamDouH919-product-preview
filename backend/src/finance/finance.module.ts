import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { JournalEntry, JournalEntrySchema } from './schemas/journal-entry.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { Coupon, CouponSchema } from '../coupons/schemas/coupon.schema';
import { Refund, RefundSchema } from '../refunds/schemas/refund.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../inventory/schemas/stock-movement.schema';
import { Purchase, PurchaseSchema } from '../purchasing/schemas/purchase.schema';
import { Courier, CourierSchema } from '../couriers/schemas/courier.schema';
import { MoneyAccount, MoneyAccountSchema } from '../money-accounts/schemas/money-account.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { CourierSettlement, CourierSettlementSchema } from '../couriers/schemas/courier-settlement.schema';
import { JournalService } from './journal.service';
import { PaymentsService } from './payments.service';
import { FinanceReportsService } from './finance-reports.service';
import { ReconciliationService } from './reconciliation.service';
import { FinanceController } from './finance.controller';
import { StatementsService } from './statements.service';
import { PeriodsService } from './periods.service';
import { StatementsController } from './statements.controller';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [AuthModule],
  controllers: [FinanceController, StatementsController],
  providers: [
    JournalService,
    PaymentsService,
    FinanceReportsService,
    ReconciliationService,
    StatementsService,
    PeriodsService,
    // Read-only here: whether the caller is this store's super admin (closing periods).
    tenantModelProvider(User.name, UserSchema),
    tenantModelProvider(JournalEntry.name, JournalEntrySchema),
    tenantModelProvider(Payment.name, PaymentSchema),
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(Setting.name, SettingSchema),
    tenantModelProvider(MoneyAccount.name, MoneyAccountSchema),
    // Read-only here: reconciling use counts against orders.
    tenantModelProvider(Coupon.name, CouponSchema),
    tenantModelProvider(Refund.name, RefundSchema),
    // Read-only here: reconciling stock value and supplier payables.
    tenantModelProvider(Product.name, ProductSchema),
    tenantModelProvider(StockMovement.name, StockMovementSchema),
    tenantModelProvider(Purchase.name, PurchaseSchema),
    // Read-only here: which courier holds a collection; reconciling expenses and settlements.
    tenantModelProvider(Courier.name, CourierSchema),
    tenantModelProvider(Expense.name, ExpenseSchema),
    tenantModelProvider(CourierSettlement.name, CourierSettlementSchema),
  ],
  exports: [JournalService, FinanceReportsService],
})
export class FinanceModule {}
