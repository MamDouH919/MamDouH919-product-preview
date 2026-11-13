import { Module, forwardRef } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role, RoleSchema } from './schemas/role.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  // The roles routes are guarded by AuthorizationGuard, which needs AuthService.
  imports: [forwardRef(() => AuthModule)],
  controllers: [RolesController],
  providers: [
    RolesService,
    tenantModelProvider(Role.name, RoleSchema),
    // Counts who holds a role, and refuses to delete one that is still in use.
    tenantModelProvider(User.name, UserSchema),
  ],
  exports: [RolesService],
})
export class RolesModule {}
