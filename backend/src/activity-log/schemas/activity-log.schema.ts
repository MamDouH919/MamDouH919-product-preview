import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

/** How long entries are kept before Mongo's TTL monitor drops them. */
export const ACTIVITY_LOG_TTL_DAYS = 365;

/**
 * One change an admin made in the dashboard. Append-only, written by
 * `ActivityLogInterceptor` — never by hand — and it records which fields were
 * sent, never their values, so a password or token can't end up in here.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Name and email as they were — the account may be renamed or deleted later. */
  @Prop({ required: false })
  userName?: string;

  @Prop({ required: false })
  userEmail?: string;

  /** e.g. "orders", "products" — the permission resource the route is guarded by. */
  @Prop({ required: true, index: true })
  resource!: string;

  /** create | update | delete. */
  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  method!: string;

  /** The route template, e.g. "/orders/:id/status". */
  @Prop({ required: true })
  path!: string;

  @Prop({ required: false })
  entityId?: string;

  /** Something a person recognises: "#1042", "SUMMER10", a product name. */
  @Prop({ required: false })
  entityLabel?: string;

  /** Top-level fields that were sent. */
  @Prop({ type: [String], default: [] })
  fields!: string[];

  @Prop({ required: false })
  ip?: string;

  createdAt!: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_LOG_TTL_DAYS * 24 * 60 * 60 });
