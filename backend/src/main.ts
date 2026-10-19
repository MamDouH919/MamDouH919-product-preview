import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TenantConnectionService } from './common/helpers/dynamic-connection';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy, set TRUST_PROXY to the number of proxy hops (e.g. 1
  // for nginx) so req.ip is the real client and rate limits are per visitor.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }

  // Custom pages are saved as one JSON document; rich-text blocks can push it
  // past Express's 100kb default.
  app.useBodyParser('json', { limit: '2mb' });

  // ✅ CORS allowlist — every tenant's frontendUrl from the tenant map, so
  // `npm run add-tenant` is the only step needed to onboard a store. Extra
  // origins (e.g. a second dev port) go in CORS_ORIGINS, comma-separated.
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = [
    ...new Set([
      ...app.get(TenantConnectionService).getAllowedOrigins(),
      ...extraOrigins,
    ]),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // allow cookies or auth headers
  });

  // ✅ Swagger setup — exposed only outside production so the API surface and
  // schemas aren't publicly browsable on the live server.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('product preview API')
      .setDescription('API documentation for Gravity application')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // ✅ Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3023);
}
bootstrap();