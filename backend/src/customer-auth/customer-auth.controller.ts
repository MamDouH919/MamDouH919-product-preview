import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
// `import type` is required: these appear bare in decorated parameter
// signatures, which `emitDecoratorMetadata` + `isolatedModules` would
// otherwise try to emit as a runtime value.
import type { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import {
  CustomerChangePasswordDto,
  CustomerForgotPasswordDto,
  CustomerLoginDto,
  CustomerRefreshDto,
  CustomerRegisterDto,
  CustomerResetPasswordDto,
} from './dto/customer-auth.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';

type CustomerRequest = Request & { customerId?: string };

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post('register')
  register(@Body() dto: CustomerRegisterDto, @Req() req: Request) {
    return this.customerAuthService.register(dto, req.hostname);
  }

  @Post('login')
  login(@Body() dto: CustomerLoginDto, @Req() req: Request) {
    return this.customerAuthService.login(dto, req.hostname);
  }

  @Post('refresh')
  refresh(@Body() dto: CustomerRefreshDto, @Req() req: Request) {
    return this.customerAuthService.refreshTokens(dto.refreshToken, req.hostname);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: CustomerForgotPasswordDto, @Req() req: Request) {
    return this.customerAuthService.forgotPassword(dto.email, req.hostname);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: CustomerResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('me')
  getMe(@Req() req: CustomerRequest) {
    return this.customerAuthService.getMe(req.customerId!);
  }

  @UseGuards(CustomerAuthGuard)
  @Put('change-password')
  changePassword(
    @Body() dto: CustomerChangePasswordDto,
    @Req() req: CustomerRequest,
  ) {
    return this.customerAuthService.changePassword(req.customerId!, dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Delete('logout')
  logout(@Req() req: CustomerRequest) {
    return this.customerAuthService.logout(req.customerId!);
  }
}
