import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { AccountType, CashFlowActivity } from '../accounts';

@Schema({ _id: false })
class AccountName {
  @Prop({ required: true, trim: true })
  en!: string;

  @Prop({ required: true, trim: true })
  ar!: string;
}

/**
 * An account a store added to its chart, beside the built-in ones (which
 * live in code, never here). The code and type are fixed once the account
 * exists: postings name it by code, and its type decides which statement
 * it reports in. An account with postings is deactivated, never deleted.
 */
@Schema({ timestamps: true })
export class LedgerAccount extends Document {
  @Prop({ required: true, unique: true, trim: true })
  code!: string;

  @Prop({ type: SchemaFactory.createForClass(AccountName), required: true })
  name!: AccountName;

  @Prop({ type: String, enum: AccountType, required: true })
  type!: AccountType;

  @Prop({ type: String, enum: CashFlowActivity, default: CashFlowActivity.OPERATING })
  cashFlowActivity!: CashFlowActivity;

  @Prop({ required: false, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const LedgerAccountSchema = SchemaFactory.createForClass(LedgerAccount);
