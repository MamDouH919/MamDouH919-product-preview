import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Connection } from 'mongoose';
import { User } from '../auth/schemas/user.schema';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async assertSuper(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user?.isSuper) throw new ForbiddenException('Super admin only');
  }

  async exportAll(userId: string): Promise<Record<string, any[]>> {
    await this.assertSuper(userId);
    const collections = await this.connection.db!.listCollections().toArray();
    const data: Record<string, any[]> = {};
    for (const col of collections) {
      data[col.name] = await this.connection.db!
        .collection(col.name)
        .find({})
        .toArray();
    }
    return data;
  }

  async importAll(userId: string, data: Record<string, any[]>): Promise<void> {
    await this.assertSuper(userId);
    for (const [colName, docs] of Object.entries(data)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;
      const col = this.connection.db!.collection(colName);
      await col.deleteMany({});
      await col.insertMany(docs);
    }
  }
}
