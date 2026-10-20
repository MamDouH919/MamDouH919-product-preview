import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto, Permission } from './dto/role.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { AuthService } from '../auth/auth.service';
import { Resource } from './enums/resource.enum';
import { Action } from './enums/action.enum';

@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly authService: AuthService,
  ) {}

  @Permissions([{ resource: Resource.Roles, actions: [Action.CREATE] }])
  @Post()
  async createRole(@Body() createRoleDto: CreateRoleDto, @Req() req: { userId: string }) {
    await this.assertCanGrant(req.userId, createRoleDto.permissions);
    return this.rolesService.createRole(createRoleDto);
  }

  @Permissions([{ resource: Resource.Roles, actions: [Action.READ] }])
  @Get()
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Permissions([{ resource: Resource.Roles, actions: [Action.READ] }])
  @Get(':id')
  async getRoleById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Permissions([{ resource: Resource.Roles, actions: [Action.UPDATE] }])
  @Put(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: CreateRoleDto,
    @Req() req: { userId: string },
  ) {
    await this.assertCanGrant(req.userId, updateRoleDto.permissions);
    return this.rolesService.updateRole(id, updateRoleDto);
  }

  @Permissions([{ resource: Resource.Roles, actions: [Action.DELETE] }])
  @Delete(':id')
  async deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  /**
   * Holding roles:update must not be a way up: anyone but a super admin can
   * only hand out actions they already have themselves.
   */
  private async assertCanGrant(userId: string, requested: Permission[] = []) {
    const user = await this.authService.getMe(userId);
    if (user.isSuper) return;

    const own = (await this.authService.getUserPermissions(userId)) ?? [];
    for (const permission of requested) {
      const held = own.find((p) => p.resource === permission.resource)?.actions ?? [];
      const missing = permission.actions.filter((action) => !held.includes(action));
      if (missing.length) {
        throw new ForbiddenException(
          `You cannot grant ${missing.join(', ')} on ${permission.resource} — you don't have it yourself`,
        );
      }
    }
  }
}
