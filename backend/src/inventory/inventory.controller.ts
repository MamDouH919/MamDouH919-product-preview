import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  BulkAdjustStockDto,
  StockTakeDto,
} from './dto/adjust-stock.dto';
import { QueryInventoryDto, QueryMovementsDto } from './dto/query-inventory.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

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

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('stock-take')
  stockTake(@Body() dto: StockTakeDto, @Req() req: Request & { userId?: string }) {
    return this.inventoryService.stockTake(dto, req.userId);
  }
}
