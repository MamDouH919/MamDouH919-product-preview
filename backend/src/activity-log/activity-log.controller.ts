import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

/** Read-only: entries are only ever written by ActivityLogInterceptor. */
@Controller('activity-log')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Permissions([{ resource: Resource.ACTIVITY_LOG, actions: [Action.READ] }])
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  findAll(@Query() query: QueryActivityLogDto) {
    return this.activityLogService.findAll(query);
  }

  @Get('facets')
  facets() {
    return this.activityLogService.facets();
  }
}
