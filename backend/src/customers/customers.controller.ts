import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import {
  AddressDto,
  QueryCustomersDto,
  SetCustomerActiveDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './dto/customer.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

type CustomerRequest = Request & { customerId?: string };

/**
 * Self-service routes. Every one of them acts on the customer in the token —
 * there is no id in any path, so one customer can never address another's
 * profile or addresses.
 */
@Controller('customers/me')
@UseGuards(CustomerAuthGuard)
export class CustomerProfileController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  getProfile(@Req() req: CustomerRequest) {
    return this.customersService.getProfile(req.customerId!);
  }

  @Patch()
  updateProfile(@Body() dto: UpdateProfileDto, @Req() req: CustomerRequest) {
    return this.customersService.updateProfile(req.customerId!, dto);
  }

  @Get('wishlist')
  getWishlist(@Req() req: CustomerRequest) {
    return this.customersService.getWishlist(req.customerId!);
  }

  @Put('wishlist/:productId')
  addToWishlist(@Param('productId') productId: string, @Req() req: CustomerRequest) {
    return this.customersService.addToWishlist(req.customerId!, productId);
  }

  @Delete('wishlist/:productId')
  removeFromWishlist(@Param('productId') productId: string, @Req() req: CustomerRequest) {
    return this.customersService.removeFromWishlist(req.customerId!, productId);
  }

  @Get('addresses')
  getAddresses(@Req() req: CustomerRequest) {
    return this.customersService.getAddresses(req.customerId!);
  }

  @Post('addresses')
  addAddress(@Body() dto: AddressDto, @Req() req: CustomerRequest) {
    return this.customersService.addAddress(req.customerId!, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: CustomerRequest,
  ) {
    return this.customersService.updateAddress(req.customerId!, addressId, dto);
  }

  @Put('addresses/:addressId/default')
  setDefaultAddress(
    @Param('addressId') addressId: string,
    @Req() req: CustomerRequest,
  ) {
    return this.customersService.setDefaultAddress(req.customerId!, addressId);
  }

  @Delete('addresses/:addressId')
  removeAddress(
    @Param('addressId') addressId: string,
    @Req() req: CustomerRequest,
  ) {
    return this.customersService.removeAddress(req.customerId!, addressId);
  }
}

/** Admin-side read and account suspension. */
@Controller('customers')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Permissions([{ resource: Resource.CUSTOMERS, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryCustomersDto) {
    return this.customersService.findAll(query);
  }

  @Permissions([{ resource: Resource.CUSTOMERS, actions: [Action.READ] }])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Permissions([{ resource: Resource.CUSTOMERS, actions: [Action.UPDATE] }])
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetCustomerActiveDto) {
    return this.customersService.setActive(id, dto.isActive);
  }
}
