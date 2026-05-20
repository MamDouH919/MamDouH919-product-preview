import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { AuthorizationGuard } from './guards/authorization.guard';

@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller("/")
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  someProtectedRoute(@Req() req) {
    console.log(req.userId);
    return { message: 'Accessed Resource', userId: req.userId };
  }
}
