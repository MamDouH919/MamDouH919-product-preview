import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-schema.schema';
import { Otp, OtpSchema } from './schemas/otp.schema';
import { MailModule } from '../mail/mail.module';
import { ResetToken, ResetTokenSchema } from './schemas/reset-token.schema';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: RefreshToken.name,
        schema: RefreshTokenSchema,
      },
      {
        name: Otp.name,
        schema: OtpSchema,
      },
      {
        name: ResetToken.name,
        schema: ResetTokenSchema ,
      },
    ]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
