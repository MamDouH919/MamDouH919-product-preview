import { Module } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import {
  CustomerRefreshToken,
  CustomerRefreshTokenSchema,
  CustomerResetToken,
  CustomerResetTokenSchema,
} from './schemas/customer-token.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { MailModule } from '../mail/mail.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [MailModule],
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    CustomerAuthGuard,
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(CustomerRefreshToken.name, CustomerRefreshTokenSchema),
    tenantModelProvider(CustomerResetToken.name, CustomerResetTokenSchema),
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
