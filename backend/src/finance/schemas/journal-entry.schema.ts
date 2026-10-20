import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { ACCOUNT_CODES } from '../accounts';

// Ids here are `SchemaTypes.ObjectId`, not `Types.ObjectId`: @nestjs/mongoose
// turns the latter into Mixed, which stores whatever it is given uncast — and
// the books must never hold an order id as a string that its queries miss.

/** One side of an entry. Exactly one of debit or credit is above zero. */
@Schema({ _id: false })
export class JournalLine {
  @Prop({ type: String, enum: ACCOUNT_CODES, required: true })
  account!: string;

  @Prop({ required: true, min: 0, default: 0 })
  debitMinor!: number;

  @Prop({ required: true, min: 0, default: 0 })
  creditMinor!: number;

  /** The order the line is about, so receivables and sales can be traced per order. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: false })
  order?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: false })
  customer?: Types.ObjectId;

  /** On cash lines: which cash box, bank or wallet the money moved through. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'MoneyAccount', required: false })
  moneyAccount?: Types.ObjectId;
}

export const JournalLineSchema = SchemaFactory.createForClass(JournalLine);

/** What made an entry: a document and the event on it, e.g. order #1001 "delivered". */
@Schema({ _id: false })
export class JournalSource {
  @Prop({ required: true })
  type!: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  id!: Types.ObjectId;

  /** The document's human-facing number, for reading the books. */
  @Prop({ required: false })
  number?: number;

  @Prop({ required: true })
  event!: string;
}

export const JournalSourceSchema = SchemaFactory.createForClass(JournalSource);

/**
 * The books. Every amount a report shows is a sum of these lines. Entries are
 * written by business events, inside the same transaction as the event, and
 * never edited or deleted: a mistake is undone by a reversing entry.
 */
@Schema({ timestamps: { createdAt: 'postedAt', updatedAt: false } })
export class JournalEntry extends Document {
  @Prop({ required: true, unique: true })
  entryNumber!: number;

  /** When the event happened — what decides the period it reports in. Not when it was typed. */
  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  @Prop({ type: JournalSourceSchema, required: true })
  source!: JournalSource;

  @Prop({ type: [JournalLineSchema], required: true })
  lines!: JournalLine[];

  @Prop({ required: false })
  memo?: string;

  /** The admin whose action posted it. Absent for customer and system events. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  /** Set on a reversing entry: the entry it cancels. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'JournalEntry', required: false })
  reversalOf?: Types.ObjectId;

  postedAt!: Date;
}

export const JournalEntrySchema = SchemaFactory.createForClass(JournalEntry);

// One entry per event on a document: a retried request can never post twice.
JournalEntrySchema.index({ 'source.type': 1, 'source.id': 1, 'source.event': 1 }, { unique: true });
JournalEntrySchema.index({ 'lines.account': 1, date: 1 });
JournalEntrySchema.index({ 'lines.order': 1 });
