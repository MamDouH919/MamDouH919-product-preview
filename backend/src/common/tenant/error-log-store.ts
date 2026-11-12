import { createHash } from 'crypto';
import { Connection, Model, Schema, Types } from 'mongoose';

export type ErrorStatus = 'new' | 'resolved' | 'ignored';
export const ERROR_STATUSES: readonly ErrorStatus[] = ['new', 'resolved', 'ignored'];

/** Groups untouched this long are dropped, as are single occurrences. */
const GROUP_TTL_SECONDS = 90 * 24 * 60 * 60;
const EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;

/** One error as it happened, before grouping. No request body or headers: they can hold passwords and tokens. */
export interface ErrorInput {
  /** The store's host, or `platform` for the platform dashboard's own API. */
  host: string;
  method: string;
  /** The route with ids masked (`/orders/:id`), so one bug is one group. */
  route: string;
  statusCode: number;
  name: string;
  message: string;
  stack?: string;
}

/** Same bug, same store, same route → same group. */
interface StoredGroup {
  fingerprint: string;
  host: string;
  method: string;
  route: string;
  statusCode: number;
  name: string;
  message: string;
  stack?: string;
  count: number;
  status: ErrorStatus;
  note?: string;
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt?: Date;
}

interface StoredEvent {
  host: string;
  statusCode: number;
  fingerprint: string;
  at: Date;
}

const GroupSchema = new Schema<StoredGroup>(
  {
    fingerprint: { type: String, required: true, unique: true },
    host: { type: String, required: true, index: true },
    method: String,
    route: String,
    statusCode: Number,
    name: String,
    message: String,
    stack: String,
    count: { type: Number, default: 1 },
    status: { type: String, enum: ERROR_STATUSES, default: 'new', index: true },
    note: String,
    firstSeen: { type: Date, required: true },
    lastSeen: { type: Date, required: true, index: true, expires: GROUP_TTL_SECONDS },
    resolvedAt: Date,
  },
  { collection: 'error_groups' },
);

const EventSchema = new Schema<StoredEvent>(
  {
    host: { type: String, required: true },
    statusCode: Number,
    fingerprint: String,
    at: { type: Date, required: true, expires: EVENT_TTL_SECONDS },
  },
  { collection: 'error_events' },
);

export interface ErrorQuery {
  host?: string;
  status?: ErrorStatus;
  statusCode?: number;
  q?: string;
  page: number;
  limit: number;
}

export interface ErrorGroupView extends Omit<StoredGroup, 'resolvedAt' | 'note' | 'stack'> {
  id: string;
  note: string | null;
  stack: string | null;
  resolvedAt: Date | null;
}

export interface ErrorStats {
  totals: { groups: number; new: number; resolved: number; ignored: number; events: number };
  perDay: { date: string; count: number }[];
  byHost: { host: string; count: number }[];
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Numbers, ids and quoted values vary per request; masking them keeps one bug in one group. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{24}/gi, ':id')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\d+/g, 'N')
    .slice(0, 300);
}

export function fingerprintOf(e: ErrorInput): string {
  return createHash('sha1')
    .update([e.host, e.method, e.route, e.statusCode, e.name, normalizeMessage(e.message)].join('|'))
    .digest('hex');
}

/** The API's own error log, kept in the platform database next to the tenant registry. */
export class ErrorLogStore {
  private readonly groups: Model<StoredGroup>;
  private readonly events: Model<StoredEvent>;

  constructor(connection: Connection) {
    this.groups = connection.model<StoredGroup>('ErrorGroup', GroupSchema);
    this.events = connection.model<StoredEvent>('ErrorEvent', EventSchema);
  }

  async init(): Promise<void> {
    await Promise.all([this.groups.init(), this.events.init()]);
  }

  /** Counts the error into its group (reopening a resolved one: it came back) and the daily series. */
  async record(input: ErrorInput): Promise<void> {
    const fingerprint = fingerprintOf(input);
    const now = new Date();
    await this.groups.updateOne(
      { fingerprint },
      {
        $inc: { count: 1 },
        $set: { lastSeen: now, message: input.message.slice(0, 1000), stack: input.stack?.slice(0, 6000) },
        $setOnInsert: {
          host: input.host,
          method: input.method,
          route: input.route,
          statusCode: input.statusCode,
          name: input.name,
          firstSeen: now,
        },
      },
      { upsert: true },
    );
    // A resolved group that fires again is a regression; an ignored one stays ignored.
    await this.groups.updateOne(
      { fingerprint, status: 'resolved' },
      { $set: { status: 'new' }, $unset: { resolvedAt: 1 } },
    );
    await this.events.create({ host: input.host, statusCode: input.statusCode, fingerprint, at: now });
  }

  async list(query: ErrorQuery): Promise<{ items: ErrorGroupView[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.host) filter.host = query.host;
    if (query.status) filter.status = query.status;
    if (query.statusCode) filter.statusCode = query.statusCode;
    if (query.q) {
      const re = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ message: re }, { route: re }, { name: re }];
    }
    const [docs, total] = await Promise.all([
      this.groups
        .find(filter)
        .sort({ lastSeen: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.groups.countDocuments(filter),
    ]);
    return { items: docs.map(toView), total };
  }

  async update(id: string, patch: { status?: ErrorStatus; note?: string }): Promise<ErrorGroupView | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    if (patch.status) {
      $set.status = patch.status;
      if (patch.status === 'resolved') $set.resolvedAt = new Date();
      else $unset.resolvedAt = 1;
    }
    if (patch.note !== undefined) {
      if (patch.note) $set.note = patch.note;
      else $unset.note = 1;
    }
    const doc = await this.groups
      .findByIdAndUpdate(id, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) }, { new: true })
      .lean();
    return doc ? toView(doc) : null;
  }

  async remove(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const doc = await this.groups.findByIdAndDelete(id).lean();
    if (doc) await this.events.deleteMany({ fingerprint: doc.fingerprint });
    return Boolean(doc);
  }

  /** Counts over the last `days` days (UTC), with empty days filled in for the chart. */
  async stats(days: number): Promise<ErrorStats> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [byStatus, perDayRaw, byHost] = await Promise.all([
      this.groups.aggregate<{ _id: ErrorStatus; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      this.events.aggregate<{ _id: string; n: number }>([
        { $match: { at: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'UTC' } }, n: { $sum: 1 } } },
      ]),
      this.events.aggregate<{ _id: string; n: number }>([
        { $match: { at: { $gte: since } } },
        { $group: { _id: '$host', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const counts = new Map(perDayRaw.map((d) => [d._id, d.n]));
    const perDay = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return { date, count: counts.get(date) ?? 0 };
    });

    const status = (s: ErrorStatus) => byStatus.find((b) => b._id === s)?.n ?? 0;
    return {
      totals: {
        groups: byStatus.reduce((sum, b) => sum + b.n, 0),
        new: status('new'),
        resolved: status('resolved'),
        ignored: status('ignored'),
        events: perDay.reduce((sum, d) => sum + d.count, 0),
      },
      perDay,
      byHost: byHost.map((h) => ({ host: h._id, count: h.n })),
    };
  }
}

function toView(doc: StoredGroup & { _id: Types.ObjectId }): ErrorGroupView {
  const { _id, note, stack, resolvedAt, ...rest } = doc as StoredGroup & { _id: Types.ObjectId; __v?: number };
  delete (rest as { __v?: number }).__v;
  return { id: String(_id), ...rest, note: note ?? null, stack: stack ?? null, resolvedAt: resolvedAt ?? null };
}
