import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TenantConnectionService } from './common/helpers/dynamic-connection';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Dynamic CORS: every tenant's frontend origin is allowed automatically,
  // sourced from the same tenant config used for DB routing. Adding a tenant
  // (config.json / TENANT_MAP) updates the allowlist with no code change.
  const tenantService = app.get(TenantConnectionService);
  const allowedOrigins = new Set(tenantService.getAllowedOrigins());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, server-to-server) that send no Origin.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      }
    },
    credentials: true, // allow cookies or auth headers
  });

  // ✅ Swagger setup — exposed only outside production so the API surface and
  // schemas aren't publicly browsable on the live server.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Gravity API')
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