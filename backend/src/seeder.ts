import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from './common/helpers/dynamic-connection';
import { seedTenant } from './common/tenant/seed-tenant';

async function seed() {
  // Tenant to seed: `npm run seed -- <host>` or TENANT_HOST env var.
  const host = process.argv[2] ?? process.env.TENANT_HOST;
  if (!host) {
    throw new Error(
      'No tenant host provided. Usage: npm run seed -- <host> (must exist in config.json)',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  const configService = app.get(ConfigService);
  const tenantConnection = app.get(TenantConnectionService);

  const connection = await tenantConnection.getConnection(host);

  console.log(`Seeding tenant "${host}"...`);

  const superAdmin = configService.get<string>('seed.superAdminName')
    ? {
        name: configService.getOrThrow<string>('seed.superAdminName'),
        email: configService.getOrThrow<string>('seed.superAdminEmail'),
        password: configService.getOrThrow<string>('seed.superAdminPassword'),
      }
    : undefined;

  const log = await seedTenant(connection, {
    admin: {
      name: configService.getOrThrow<string>('seed.adminName'),
      email: configService.getOrThrow<string>('seed.adminEmail'),
      password: configService.getOrThrow<string>('seed.adminPassword'),
    },
    superAdmin,
  });
  log.forEach((line) => console.log(line));

  await app.close();
  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
