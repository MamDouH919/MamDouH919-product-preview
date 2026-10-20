import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { EXPENSE_ACCOUNTS } from '../../finance/accounts';

export enum ExpenseStatus {
  POSTED = 'posted',
  /** Recorded by mistake and undone by a reversing entry. Kept, never deleted. */
  REVERSED = 'reversed',
}

/** A running cost of the store, paid from its cash. Amounts are minor units. */
@Schema({ timestamps: true })
export class Expense extends Document {
  @Prop({ required: true, unique: true })
  expenseNumber!: number;

  /** When it was incurred and paid — the date it reports in. */
  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  /** Its category: one of the expense accounts. */
  @Prop({ type: String, enum: EXPENSE_ACCOUNTS, required: true })
  account!: string;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ required: true, trim: true })
  description!: string;

  /** A receipt or invoice number, to find the paper. */
  @Prop({ required: false, trim: true })
  reference?: string;

  /** The order a delivery cost was for — a failed attempt, a return pickup. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: false, index: true })
  order?: Types.ObjectId;

  @Prop({ required: false })
  orderNumber?: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Courier', required: false })
  courier?: Types.ObjectId;

  @Prop({ type: String, enum: ExpenseStatus, default: ExpenseStatus.POSTED, index: true })
  status!: ExpenseStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  reversedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  reversedAt?: Date;

  @Prop({ required: false })
  reverseReason?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
