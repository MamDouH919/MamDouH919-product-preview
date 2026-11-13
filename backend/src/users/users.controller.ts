import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService, Actor } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { AuthService } from '../auth/auth.service';

/** Part of the paid staff add-on: answers 404 on a store that hasn't got it. */
@RequireModules(StoreModule.TEAM)
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Permissions([{ resource: Resource.USERS, actions: [Action.READ] }])
  @Get()
  list(@Query('search') search?: string) {
    return this.usersService.list(search);
  }

  @Permissions([{ resource: Resource.USERS, actions: [Action.READ] }])
  @Get(':id')
  get(@Param('id') id: string) {
    return this.usersService.get(id);
  }

  @Permissions([{ resource: Resource.USERS, actions: [Action.CREATE] }])
  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: { userId: string }) {
    return this.usersService.create(dto, await this.actor(req.userId));
  }

  @Permissions([{ resource: Resource.USERS, actions: [Action.UPDATE] }])
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: { userId: string }) {
    return this.usersService.update(id, dto, await this.actor(req.userId));
  }

  @Permissions([{ resource: Resource.USERS, actions: [Action.DELETE] }])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { userId: string }) {
    return this.usersService.remove(id, await this.actor(req.userId));
  }

  private async actor(userId: string): Promise<Actor> {
    const me = await this.authService.getMe(userId);
    return {
      userId,
      isSuper: Boolean(me.isSuper),
      permissions: await this.authService.getUserPermissions(userId),
    };
  }
}
