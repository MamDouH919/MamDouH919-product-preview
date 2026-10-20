import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { MoneyAccount, MoneyAccountSchema } from './schemas/money-account.schema';
import { MoneyTransfer, MoneyTransferSchema } from './schemas/money-transfer.schema';
import { JournalEntry, JournalEntrySchema } from '../finance/schemas/journal-entry.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { MoneyAccountsService } from './money-accounts.service';
import { MoneyAccountsController } from './money-accounts.controller';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [MoneyAccountsController],
  providers: [
    MoneyAccountsService,
    tenantModelProvider(MoneyAccount.name, MoneyAccountSchema),
    tenantModelProvider(MoneyTransfer.name, MoneyTransferSchema),
    tenantModelProvider(JournalEntry.name, JournalEntrySchema),
    tenantModelProvider(Counter.name, CounterSchema),
  ],
  exports: [MoneyAccountsService],
})
export class MoneyAccountsModule {}
