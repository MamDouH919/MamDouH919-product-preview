import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { MoneyAccountsService } from './money-accounts.service';
import { CreateMoneyAccountDto, TransferMoneyDto, UpdateMoneyAccountDto } from './dto/money-account.dto';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

@RequireModules(StoreModule.FINANCE)
@Controller('finance/money-accounts')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class MoneyAccountsController {
  constructor(private readonly accounts: MoneyAccountsService) {}

  /** Listing is what every money form needs to offer a choice, so it rides on payments:read. */
  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.READ] }])
  @Get()
  list() {
    return this.accounts.list();
  }

  @Permissions([{ resource: Resource.MONEY_ACCOUNTS, actions: [Action.CREATE] }])
  @Post()
  create(@Body() dto: CreateMoneyAccountDto) {
    return this.accounts.create(dto);
  }

  @Permissions([{ resource: Resource.MONEY_ACCOUNTS, actions: [Action.UPDATE] }])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMoneyAccountDto) {
    return this.accounts.update(id, dto);
  }

  @Permissions([{ resource: Resource.MONEY_ACCOUNTS, actions: [Action.EXECUTE] }])
  @Post('transfers')
  transfer(@Body() dto: TransferMoneyDto, @Req() req: Request & { userId?: string }) {
    return this.accounts.transfer(dto, req.userId);
  }
}
