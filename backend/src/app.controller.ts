import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { Connection } from 'mongoose';
import { AuthenticationGuard } from './guards/authentication.guard';
import { AuthorizationGuard } from './guards/authorization.guard';
import { TENANT_CONNECTION } from './common/tenant/tenant.module';

// @UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller("/")
export class AppController {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: Connection,
  ) { }

  @Get()
  async someProtectedRoute(@Req() req) {
    const host = req.tenant;

    const products = await this.db.collection('products').find().toArray();

    return {
      tenant: host,
      products,
    };
  }
}
