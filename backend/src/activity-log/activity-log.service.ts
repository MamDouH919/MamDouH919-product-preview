import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { ActivityLog } from './schemas/activity-log.schema';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { User } from '../auth/schemas/user.schema';

const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name) private logModel: Model<ActivityLog>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /** Super admins' entries are hidden from everyone who isn't one. Returns the ids to exclude. */
  private async hiddenUsers(viewerId?: string): Promise<Types.ObjectId[]> {
    const viewer = viewerId ? await this.userModel.findById(viewerId).select('isSuper').lean().exec() : null;
    if (viewer?.isSuper) return [];
    const supers = await this.userModel.find({ isSuper: true }).select('_id').lean().exec();
    return supers.map((u) => u._id as Types.ObjectId);
  }

  async findAll(query: QueryActivityLogDto, viewerId?: string) {
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 50;

    const hidden = await this.hiddenUsers(viewerId);
    const filter: QueryFilter<ActivityLog> = {};
    if (query.userId) {
      const id = new Types.ObjectId(query.userId);
      filter.user = hidden.some((h) => h.equals(id)) ? { $in: [] } : id;
    } else if (hidden.length) {
      filter.user = { $nin: hidden };
    }
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
  async facets(viewerId?: string) {
    const hidden = await this.hiddenUsers(viewerId);
    const match = hidden.length ? { user: { $nin: hidden } } : {};
    const [users, resources] = await Promise.all([
      this.logModel
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$user', name: { $first: '$userName' }, email: { $first: '$userEmail' } } },
          { $sort: { name: 1 } },
        ])
        .exec(),
      this.logModel.distinct('resource', match).exec(),
    ]);
    return {
      users: users.map((u) => ({ _id: String(u._id), name: u.name, email: u.email })),
      resources: (resources as string[]).sort(),
    };
  }
}
