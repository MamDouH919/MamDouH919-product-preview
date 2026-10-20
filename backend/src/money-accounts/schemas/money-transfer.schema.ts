import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

/** Money moved between two of the store's accounts — cash banked, a wallet emptied. */
@Schema({ timestamps: true })
export class MoneyTransfer extends Document {
  @Prop({ required: true, unique: true })
  transferNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'MoneyAccount', required: true })
  from!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'MoneyAccount', required: true })
  to!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const MoneyTransferSchema = SchemaFactory.createForClass(MoneyTransfer);
