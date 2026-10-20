import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    tenantModelProvider(Expense.name, ExpenseSchema),
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
})
export class ExpensesModule {}
