import { Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService, tenantModelProvider(User.name, UserSchema)],
})
export class DatabaseModule {}
