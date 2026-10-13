import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscribe } from './schemas/subscribe.schema';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';

@Injectable()
export class SubscribeService {
  constructor(
    @InjectModel(Subscribe.name) private subscribeModel: Model<Subscribe>,
  ) {}

  /**
   * Idempotent: subscribing an address that's already on the list changes
   * nothing, and the reply is the same either way — so the form can't be used
   * to find out who is subscribed.
   */
  async create(dto: CreateSubscribeDto): Promise<{ message: string }> {
    // Normalized here: the controller's ValidationPipe doesn't run transforms.
    const email = dto.email.trim().toLowerCase();
    await this.subscribeModel
      .updateOne({ email }, { $setOnInsert: { ...dto, email } }, { upsert: true })
      .exec();
    return { message: 'Subscribed' };
  }

  async findAll(): Promise<Subscribe[]> {
    return this.subscribeModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Subscribe | null> {
    return this.subscribeModel.findById(id).exec();
  }

  async remove(id: string): Promise<void> {
    await this.subscribeModel.findByIdAndDelete(id).exec();
  }
}
