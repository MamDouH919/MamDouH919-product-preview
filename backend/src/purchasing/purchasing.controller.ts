import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { PurchasingService } from './purchasing.service';
import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  CreateSupplierPaymentDto,
  QueryPurchasesDto,
  UpdatePurchaseDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type AdminRequest = Request & { userId?: string };

/** Buying stock. Drafts are edited freely; posting, returning and paying move stock and money (`execute`). */
@RequireModules(StoreModule.INVENTORY, StoreModule.FINANCE)
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.READ] }])
  @Get('suppliers')
  suppliers() {
    return this.purchasing.suppliers();
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.READ] }])
  @Get('suppliers/:id')
  supplier(@Param('id') id: string) {
    return this.purchasing.supplier(id);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.CREATE] }])
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchasing.createSupplier(dto);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.UPDATE] }])
  @Patch('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchasing.updateSupplier(id, dto);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.READ] }])
  @Get('purchases')
  purchases(@Query() query: QueryPurchasesDto) {
    return this.purchasing.purchases(query);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.READ] }])
  @Get('purchases/:id')
  purchase(@Param('id') id: string) {
    return this.purchasing.purchase(id);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.CREATE] }])
  @Post('purchases')
  createPurchase(@Body() dto: CreatePurchaseDto, @Req() req: AdminRequest) {
    return this.purchasing.createPurchase(dto, req.userId);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.UPDATE] }])
  @Patch('purchases/:id')
  updatePurchase(@Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
    return this.purchasing.updatePurchase(id, dto);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.DELETE] }])
  @Delete('purchases/:id')
  deletePurchase(@Param('id') id: string) {
    return this.purchasing.deletePurchase(id);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.EXECUTE] }])
  @Post('purchases/:id/post')
  postPurchase(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.purchasing.postPurchase(id, req.userId);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.EXECUTE] }])
  @Post('purchase-returns')
  returnToSupplier(@Body() dto: CreatePurchaseReturnDto, @Req() req: AdminRequest) {
    return this.purchasing.returnToSupplier(dto, req.userId);
  }

  @Permissions([{ resource: Resource.PURCHASES, actions: [Action.EXECUTE] }])
  @Post('supplier-payments')
  paySupplier(@Body() dto: CreateSupplierPaymentDto, @Req() req: AdminRequest) {
    return this.purchasing.paySupplier(dto, req.userId);
  }
}
