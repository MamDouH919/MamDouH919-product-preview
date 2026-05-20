import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { User } from './auth/schemas/user.schema';
import { Role } from './roles/schemas/role.schema';
import { Resource } from './roles/enums/resource.enum';
import { Action } from './roles/enums/action.enum';
import { servicesData } from './seeds/services.seed';
import * as bcrypt from 'bcrypt';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const configService = app.get(ConfigService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const roleModel = app.get<Model<Role>>(getModelToken(Role.name));

  const adminName = configService.getOrThrow<string>('seed.adminName');
  const adminEmail = configService.getOrThrow<string>('seed.adminEmail');
  const adminPassword = configService.getOrThrow<string>('seed.adminPassword');

  const allPermissions = Object.values(Resource).map((resource) => ({
    resource,
    actions: Object.values(Action),
  }));

  // --- Admin Role (create or update permissions) ---
  let adminRole = await roleModel.findOneAndUpdate(
    { name: 'admin' },
    { permissions: allPermissions },
    { returnDocument: 'after' },
  );
  if (!adminRole) {
    adminRole = await roleModel.create({
      name: 'admin',
      permissions: allPermissions,
    });
    console.log('Admin role created');
  } else {
    console.log('Admin role updated with all permissions');
  }

  // --- Super Admin Role (create or update permissions) ---
  let superAdminRole = await roleModel.findOneAndUpdate(
    { name: 'super_admin' },
    { permissions: allPermissions },
    { returnDocument: 'after' },
  );
  if (!superAdminRole) {
    superAdminRole = await roleModel.create({
      name: 'super_admin',
      permissions: allPermissions,
    });
    console.log('Super Admin role created');
  } else {
    console.log('Super Admin role updated with all permissions');
  }

  // --- Admin User ---
  const adminExists = await userModel.findOne({ email: adminEmail });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await userModel.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      isVerified: true,
      isSuper: false,
      roleId: adminRole._id,
    });
    console.log(`Admin user created (${adminEmail})`);
  } else {
    console.log('Admin user already exists');
  }

  // --- Super Admin User ---
  if (configService.get<string>('seed.superAdminName')) {
    const superAdminName = configService.getOrThrow<string>('seed.superAdminName');
    const superAdminEmail = configService.getOrThrow<string>('seed.superAdminEmail');
    const superAdminPassword = configService.getOrThrow<string>('seed.superAdminPassword');

    const superAdminExists = await userModel.findOne({ email: superAdminEmail });
    if (!superAdminExists) {
      const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
      await userModel.create({
        name: superAdminName,
        email: superAdminEmail,
        password: hashedPassword,
        isVerified: true,
        isSuper: true,
        roleId: superAdminRole._id,
      });
      console.log(`Super Admin user created (${superAdminEmail})`);
    } else {
      console.log('Super Admin user already exists');
    }
  }

  await app.close();
  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
