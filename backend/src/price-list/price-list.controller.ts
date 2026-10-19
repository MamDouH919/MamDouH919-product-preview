import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PriceListService } from './price-list.service';
import {
  CreateDeliveryPriceDto,
  QueryDeliveryPricesDto,
  SetZonePriceDto,
  UpdateDeliveryPriceDto,
} from './dto/price-list.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

/** Where the store delivers, for the storefront's zone / area pickers. */
@Controller('delivery-areas')
export class DeliveryAreasController {
  constructor(private readonly priceListService: PriceListService) {}

  @Get()
  findAll() {
    return this.priceListService.deliveryAreas();
  }
}

@Controller('price-list')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.READ] }])
  @Get('zones')
  zones() {
    return this.priceListService.zones();
  }

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryDeliveryPricesDto) {
    return this.priceListService.findAll(query);
  }

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.CREATE] }])
  @Post()
  create(@Body() dto: CreateDeliveryPriceDto) {
    return this.priceListService.create(dto);
  }

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.CREATE, Action.UPDATE] }])
  @Post('zone')
  setZonePrice(@Body() dto: SetZonePriceDto) {
    return this.priceListService.setZonePrice(dto);
  }

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.UPDATE] }])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryPriceDto) {
    return this.priceListService.update(id, dto);
  }

  @Permissions([{ resource: Resource.PRICE_LIST, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceListService.remove(id);
  }
}
