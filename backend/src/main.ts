import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ✅ CORS allowlist — add tenant frontend origins here (scheme + host + port,
// no trailing slash), e.g. 'https://ranoshka.com'.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://demo.localhost:3000',
  'http://demo.localhost:3002',
  'https://ranosh.novaslash.com',
  'https://gravity.novaslash.com',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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