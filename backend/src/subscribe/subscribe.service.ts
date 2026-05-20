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

  async create(dto: CreateSubscribeDto): Promise<Subscribe> {
    const subscriber = new this.subscribeModel(dto);
    return subscriber.save();
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
