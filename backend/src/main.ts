import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MongoErrorFilter } from './common/filters/mongo-error.filter';
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

  // ✅ CORS allowlist — every tenant's frontendUrl, read from the live tenant
  // map on each request so a store added from the platform dashboard works
  // without a restart. Extra origins (a second dev port, the platform
  // dashboard itself) go in CORS_ORIGINS, comma-separated.
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const tenants = app.get(TenantConnectionService);

  app.enableCors({
    origin: (origin, callback) =>
      callback(
        null,
        Boolean(origin) &&
          (extraOrigins.includes(origin!) || tenants.getAllowedOrigins().includes(origin!)),
      ),
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

  // ✅ Malformed ids → 400, duplicate unique keys → 409 (instead of 500)
  app.useGlobalFilters(new MongoErrorFilter(app.get(HttpAdapterHost).httpAdapter));

  await app.listen(process.env.PORT ?? 3023);
}
bootstrap();