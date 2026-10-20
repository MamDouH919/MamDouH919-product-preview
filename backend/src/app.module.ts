import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { RolesModule } from './roles/roles.module';
import { BannersModule } from './banners/banners.module';
import { SettingsModule } from './settings/settings.module';
import { SectionsModule } from './sections/sections.module';
import { SubscribeModule } from './subscribe/subscribe.module';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { CategoriesModule } from './categories/categories.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { OrdersModule } from './orders/orders.module';
import { CouponsModule } from './coupons/coupons.module';
import { PagesModule } from './pages/pages.module';
import { PriceListModule } from './price-list/price-list.module';
import { ReportsModule } from './reports/reports.module';
import { FinanceModule } from './finance/finance.module';
import { RefundsModule } from './refunds/refunds.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { CouriersModule } from './couriers/couriers.module';
import { ExpensesModule } from './expenses/expenses.module';
import { MoneyAccountsModule } from './money-accounts/money-accounts.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { CartModule } from './cart/cart.module';
import { ReturnsModule } from './returns/returns.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import config from './config/config';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantModule } from './common/tenant/tenant.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      // Anchor to the working directory so it matches where multer writes
      // uploads (`./uploads`, also cwd-relative). Using __dirname breaks after
      // `nest build`, where the compiled file lives in dist/src and resolves to
      // dist/uploads instead of the real ./uploads folder.
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // JwtModule.register({
    //   global: true,
    //   secret: '123',
    // }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config]
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config) => ({
        secret: config.get('jwt.secret'),
      }),
      global: true,
      inject: [ConfigService],
    }),
    // Default limit for routes guarded by AuthThrottlerGuard (credential
    // endpoints); individual routes tighten it with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    AuthModule,
    RolesModule,
    BannersModule,
    SettingsModule,
    SectionsModule,
    SubscribeModule,
    ContactModule,
    DatabaseModule,
    CategoriesModule,
    SubCategoriesModule,
    ProductsModule,
    InventoryModule,
    CustomerAuthModule,
    CustomersModule,
    OrdersModule,
    CouponsModule,
    PagesModule,
    PriceListModule,
    ReportsModule,
    FinanceModule,
    RefundsModule,
    PurchasingModule,
    CouriersModule,
    ExpensesModule,
    MoneyAccountsModule,
    ReviewsModule,
    SitemapModule,
    CartModule,
    ReturnsModule,
    ActivityLogModule,
    TenantModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
