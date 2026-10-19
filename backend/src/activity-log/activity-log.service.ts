import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { ActivityLog } from './schemas/activity-log.schema';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

@Injectable()
export class ActivityLogService {
  constructor(@InjectModel(ActivityLog.name) private logModel: Model<ActivityLog>) {}

  async findAll(query: QueryActivityLogDto) {
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 50;

    const filter: QueryFilter<ActivityLog> = {};
    if (query.userId) filter.user = new Types.ObjectId(query.userId);
    if (query.resource) filter.resource = query.resource;
    if (query.action) filter.action = query.action;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const [data, total] = await Promise.all([
      this.logModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.logModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  /** Who and what appears in the log, for the filter dropdowns. */
  async facets() {
    const [users, resources] = await Promise.all([
      this.logModel
        .aggregate([
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$user', name: { $first: '$userName' }, email: { $first: '$userEmail' } } },
          { $sort: { name: 1 } },
        ])
        .exec(),
      this.logModel.distinct('resource').exec(),
    ]);
    return {
      users: users.map((u) => ({ _id: String(u._id), name: u.name, email: u.email })),
      resources: (resources as string[]).sort(),
    };
  }
}
