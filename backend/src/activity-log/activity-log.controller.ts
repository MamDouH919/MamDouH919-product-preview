import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

type AdminRequest = Request & { userId?: string };

/** Read-only: entries are only ever written by ActivityLogInterceptor. */
@Controller('activity-log')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Permissions([{ resource: Resource.ACTIVITY_LOG, actions: [Action.READ] }])
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  findAll(@Query() query: QueryActivityLogDto, @Req() req: AdminRequest) {
    return this.activityLogService.findAll(query, req.userId);
  }

  @Get('facets')
  facets(@Req() req: AdminRequest) {
    return this.activityLogService.facets(req.userId);
  }
}
