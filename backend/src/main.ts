import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable CORS for both production and localhost
  app.enableCors({
    origin: [
      'https://kaabi.mountain-egy.site',
      'http://localhost:3001',
      'http://localhost:3000',
      'http://187.127.155.122:3001',
      'https://blueskylegal.ae',
      'https://www.blueskylegal.ae',
      'https://api.blueskylegal.ae',
      'http://10.246.212.47:3000'
    ],
    credentials: true, // allow cookies or auth headers
  });

  // ✅ Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Gravity API')
    .setDescription('API documentation for Gravity application')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

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