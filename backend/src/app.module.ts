import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { RolesModule } from './roles/roles.module';
import { BannersModule } from './banners/banners.module';
import { SettingsModule } from './settings/settings.module';
import { SectionsModule } from './sections/sections.module';
import { SubscribeModule } from './subscribe/subscribe.module';
import { DatabaseModule } from './database/database.module';
import { CategoriesModule } from './categories/categories.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { ProductsModule } from './products/products.module';
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
    AuthModule,
    RolesModule,
    BannersModule,
    SettingsModule,
    SectionsModule,
    SubscribeModule,
    DatabaseModule,
    CategoriesModule,
    SubCategoriesModule,
    ProductsModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
