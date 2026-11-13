import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../guards/auth-throttler.guard';
import { PlatformAuthGuard } from '../guards/platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { CreateTenantDto, SeedTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { RestoreBackupDto } from './dto/backup.dto';
import { BackupService } from '../backup/backup.service';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { ErrorStatsQueryDto, QueryErrorsDto, UpdateErrorDto } from './dto/errors.dto';
import { PriceChangeSummaryQueryDto, QueryPriceChangesDto } from './dto/price-changes.dto';

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

/** A store's backups in the private R2 bucket: list, take one now, download, restore. */
@Controller('platform/tenants/:host/backups')
@UseGuards(PlatformAuthGuard)
export class PlatformBackupsController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  list(@Param('host') host: string) {
    return this.backups.list(host);
  }

  @Post()
  create(@Param('host') host: string) {
    return this.backups.create(host, 'manual');
  }

  @Get(':id')
  async download(@Param('host') host: string, @Param('id') id: string, @Res() res: Response) {
    const file = await this.backups.download(host, id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${host}_${id}"`);
    res.send(file);
  }

  /** Dry run unless `dryRun` is false; a real restore needs `confirm` set to the host. */
  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('host') host: string, @Param('id') id: string, @Body() dto: RestoreBackupDto) {
    return this.backups.restore(host, id, { dryRun: dto.dryRun !== false, confirm: dto.confirm });
  }
}


/** Server errors from every store and the platform API, grouped by cause. */
@Controller('platform/errors')
@UseGuards(PlatformAuthGuard)
export class PlatformErrorsController {
  constructor(private readonly tenants: TenantConnectionService) {}

  @Get()
  list(@Query() query: QueryErrorsDto) {
    return this.tenants.getRegistry().errors.list({ ...query, page: query.page ?? 1, limit: query.limit ?? 20 });
  }

  @Get('stats')
  stats(@Query() query: ErrorStatsQueryDto) {
    return this.tenants.getRegistry().errors.stats(query.days ?? 14);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateErrorDto) {
    const updated = await this.tenants.getRegistry().errors.update(id, dto);
    if (!updated) throw new NotFoundException('Error not found');
    return updated;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    if (!(await this.tenants.getRegistry().errors.remove(id))) throw new NotFoundException('Error not found');
  }
}

/** Every change to a product's selling price or cost, from every store — read-only, for following what stores charge. */
@Controller('platform/price-changes')
@UseGuards(PlatformAuthGuard)
export class PlatformPriceChangesController {
  constructor(private readonly tenants: TenantConnectionService) {}

  @Get()
  list(@Query() query: QueryPriceChangesDto) {
    return this.tenants.getRegistry().priceChanges.list({ ...query, page: query.page ?? 1, limit: query.limit ?? 25 });
  }

  @Get('summary')
  summary(@Query() query: PriceChangeSummaryQueryDto) {
    return this.tenants.getRegistry().priceChanges.summary(query.days ?? 7, query.host);
  }
}
