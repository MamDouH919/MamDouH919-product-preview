import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { InventoryService } from './inventory.service';
import { CreateTransferDto, CreateWarehouseDto, QueryTransfersDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

@RequireModules(StoreModule.INVENTORY)
@Controller('warehouses')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class WarehousesController {
  constructor(
    private readonly warehouses: WarehousesService,
    private readonly inventory: InventoryService,
  ) {}

  /** Every warehouse with the units it holds, and how many the plan allows. */
  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get()
  list() {
    return this.warehouses.list();
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.READ] }])
  @Get('transfers')
  transfers(@Query() query: QueryTransfersDto) {
    return this.inventory.getTransfers(query);
  }

  /** Moves units from one warehouse to another, in one step. */
  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post('transfers')
  transfer(@Body() dto: CreateTransferDto, @Req() req: { userId?: string }) {
    return this.inventory.transfer(dto, req.userId);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.CREATE] }])
  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  /** Makes this the warehouse sales take stock from. */
  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.UPDATE] }])
  @Post(':id/main')
  setMain(@Param('id') id: string) {
    return this.warehouses.setMain(id);
  }

  @Permissions([{ resource: Resource.INVENTORY, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.warehouses.remove(id);
  }
}
