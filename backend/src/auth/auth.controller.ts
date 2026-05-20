import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh.dto';
import { SignupDto } from './dtos/signup.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { ResendOtpDto } from './dtos/resend-otp.dto';
import { Body, Controller, Get, Post, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ForgotPasswordDto } from './dtos/forget-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() credential: LoginDto) {
    return this.authService.login(credential);
  }

  @Post('refresh')
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.token);
  }

  @UseGuards(AuthenticationGuard)
  @Put('change-password')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req
  ) {
    return this.authService.changePassword(
      req.userId,
      changePasswordDto.newPassword,
      changePasswordDto.oldPassword,
    );
  }

  @Post('forgot-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgotPasswordDto) {
    return this.authService.forgetPassword(forgetPasswordDto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('me')
  async getMe(@Req() req: { userId: string }) {
    return this.authService.getMe(req.userId);
  }

  @UseGuards(AuthenticationGuard)
  @Delete('logout')
  async logout(@Req() req: { userId: string }) {
    return this.authService.logout(req.userId);
  }
}
