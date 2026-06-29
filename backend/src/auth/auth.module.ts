import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from './schemas/user.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-schema.schema';
import { Otp, OtpSchema } from './schemas/otp.schema';
import { MailModule } from '../mail/mail.module';
import { ResetToken, ResetTokenSchema } from './schemas/reset-token.schema';
import { RolesModule } from '../roles/roles.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [RolesModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    tenantModelProvider(User.name, UserSchema),
    tenantModelProvider(RefreshToken.name, RefreshTokenSchema),
    tenantModelProvider(Otp.name, OtpSchema),
    tenantModelProvider(ResetToken.name, ResetTokenSchema),
  ],
  exports: [AuthService],
})
export class AuthModule {}
