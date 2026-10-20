import { Module, forwardRef } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role, RoleSchema } from './schemas/role.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';
import { AuthModule } from '../auth/auth.module';

@Module({
  // The roles routes are guarded by AuthorizationGuard, which needs AuthService.
  imports: [forwardRef(() => AuthModule)],
  controllers: [RolesController],
  providers: [RolesService, tenantModelProvider(Role.name, RoleSchema)],
  exports: [RolesService],
})
export class RolesModule {}
