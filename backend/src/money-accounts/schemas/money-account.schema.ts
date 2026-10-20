import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum MoneyAccountType {
  CASH = 'cash',
  BANK = 'bank',
  /** A mobile wallet or payment service (Vodafone Cash, InstaPay…). */
  WALLET = 'wallet',
}

/**
 * Somewhere the store's money is kept: a cash box, a bank account, a wallet.
 * In the books they are all the cash account (1000); each journal line on it
 * names one of these, so each has its own balance.
 */
@Schema({ timestamps: true })
export class MoneyAccount extends Document {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: MoneyAccountType, default: MoneyAccountType.CASH })
  type!: MoneyAccountType;

  /** Where money goes when nobody picks: the store's main cash box. Exactly one. */
  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const MoneyAccountSchema = SchemaFactory.createForClass(MoneyAccount);
// One default per store: two first payments racing to create it can't both succeed.
// Named, so it never collides with the plain `isDefault_1` index an earlier
// version of this schema created on some stores.
MoneyAccountSchema.index({ isDefault: 1 }, { name: 'one_default', unique: true, partialFilterExpression: { isDefault: true } });
