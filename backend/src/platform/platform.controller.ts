import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../guards/auth-throttler.guard';
import { PlatformAuthGuard } from '../guards/platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { CreateTenantDto, SeedTenantDto, UpdateTenantDto } from './dto/tenant.dto';

/** Login for the platform dashboard. Not tied to any store's host. */
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly authService: PlatformAuthService) {}

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() credentials: PlatformLoginDto) {
    return this.authService.login(credentials);
  }

  @UseGuards(PlatformAuthGuard)
  @Get('me')
  me(@Req() req: { platformAdmin: string }) {
    return { email: req.platformAdmin };
  }
}

/** Registering, editing and checking stores. Hosts in the path are matched exactly (lower-case). */
@Controller('platform/tenants')
@UseGuards(PlatformAuthGuard)
export class PlatformTenantsController {
  constructor(private readonly tenantsService: PlatformTenantsService) {}

  @Get()
  list() {
    return this.tenantsService.list();
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':host')
  update(@Param('host') host: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(host, dto);
  }

  @Delete(':host')
  @HttpCode(204)
  remove(@Param('host') host: string) {
    return this.tenantsService.remove(host);
  }

  @Post(':host/check')
  @HttpCode(200)
  check(@Param('host') host: string) {
    return this.tenantsService.check(host);
  }

  @Post(':host/seed')
  @HttpCode(200)
  seed(@Param('host') host: string, @Body() dto: SeedTenantDto) {
    return this.tenantsService.seed(host, dto);
  }
}
