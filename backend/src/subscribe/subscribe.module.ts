import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscribeService } from './subscribe.service';
import { SubscribeController } from './subscribe.controller';
import { Subscribe, SubscribeSchema } from './schemas/subscribe.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Subscribe.name, schema: SubscribeSchema }]),
    AuthModule,
  ],
  controllers: [SubscribeController],
  providers: [SubscribeService],
})
export class SubscribeModule {}
