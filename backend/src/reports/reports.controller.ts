import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

/** Read-only figures for the admin home page. Gated on financial reports, since revenue is what it reveals. */
@RequireModules(StoreModule.ORDERS)
@Controller('reports')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reportsService.dashboard(query);
  }
}
