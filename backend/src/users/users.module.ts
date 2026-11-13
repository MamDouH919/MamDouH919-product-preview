import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-schema.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  // The routes are guarded by AuthorizationGuard, which needs AuthService.
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [
    UsersService,
    tenantModelProvider(User.name, UserSchema),
    tenantModelProvider(Role.name, RoleSchema),
    tenantModelProvider(RefreshToken.name, RefreshTokenSchema),
  ],
})
export class UsersModule {}
