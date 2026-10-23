import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  BulkAdjustStockDto,
  StockTakeDto,
} from './dto/adjust-stock.dto';
import { QueryInventoryDto, QueryMovementsDto } from './dto/query-inventory.dto';
import { SetOpeningCostDto } from '../purchasing/dto/purchasing.dto';
import { parseMoney } from '../common/money/money';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

@RequireModules(StoreModule.INVENTORY)
@Controller('inventory')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get()
  getLevels(@Query() query: QueryInventoryDto) {
    return this.inventoryService.getLevels(query);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get('summary')
  getSummary() {
    return this.inventoryService.getSummary();
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get('movement-types')
  getMovementTypes() {
    return this.inventoryService.getMovementTypes();
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get('movements')
  getMovements(@Query() query: QueryMovementsDto) {
    return this.inventoryService.getMovements(query);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('adjust')
  adjust(@Body() dto: AdjustStockDto, @Req() req: Request & { userId?: string }) {
    return this.inventoryService.adjust(dto, req.userId);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('bulk-adjust')
  bulkAdjust(@Body() dto: BulkAdjustStockDto, @Req() req: Request & { userId?: string }) {
    return this.inventoryService.adjustMany(dto.items, req.userId);
  }

  /** Stock value at cost, item by item — the inventory valuation report. */
  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('valuation')
  valuation() {
    return this.inventoryService.getValuation();
  }

  /** Gives uncosted stock its first cost, from what it was really bought for. */
  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('opening-cost')
  setOpeningCost(@Body() dto: SetOpeningCostDto, @Req() req: { userId?: string }) {
    let unitCostMinor: number;
    try {
      unitCostMinor = parseMoney(dto.unitCost);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return this.inventoryService.setOpeningCost(dto.productId, dto.variantId, unitCostMinor, req.userId);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('stock-take')
  stockTake(@Body() dto: StockTakeDto, @Req() req: Request & { userId?: string }) {
    return this.inventoryService.stockTake(dto, req.userId);
  }
}
