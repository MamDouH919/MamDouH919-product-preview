import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role, RoleSchema } from './schemas/role.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  controllers: [RolesController],
  providers: [RolesService, tenantModelProvider(Role.name, RoleSchema)],
  exports: [RolesService],
})
export class RolesModule {}
