import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Connection } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(TENANT_CONNECTION) private connection: Connection,
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

    // Only allow writing to collections backed by a registered tenant model.
    // Without this, a super-admin (or a leaked super token) could overwrite or
    // create arbitrary collections with unvalidated documents.
    const allowed = new Set(
      this.connection.modelNames().map(
        (name) => this.connection.model(name).collection.collectionName,
      ),
    );

    for (const [colName, docs] of Object.entries(data)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;
      if (!allowed.has(colName)) continue;
      const col = this.connection.db!.collection(colName);
      await col.deleteMany({});
      await col.insertMany(docs);
    }
  }
}
