import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, QueryExpensesDto, ReverseExpenseDto } from './dto/expense.dto';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type AdminRequest = Request & { userId?: string };

@RequireModules(StoreModule.FINANCE)
@Controller('finance/expenses')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Permissions([{ resource: Resource.EXPENSES, actions: [Action.READ] }])
  @Get()
  list(@Query() query: QueryExpensesDto) {
    return this.expenses.list(query);
  }

  @Permissions([{ resource: Resource.EXPENSES, actions: [Action.CREATE] }])
  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: AdminRequest) {
    return this.expenses.create(dto, req.userId);
  }

  @Permissions([{ resource: Resource.EXPENSES, actions: [Action.APPROVE] }])
  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseExpenseDto, @Req() req: AdminRequest) {
    return this.expenses.reverse(id, dto.reason, req.userId);
  }
}
