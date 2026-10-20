import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

@Schema({ _id: false })
export class PurchaseReturnLine {
  /** Position of the line in the purchase. */
  @Prop({ required: true, min: 0 })
  lineIndex!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  /** What the units cost when bought — what leaves stock and comes off what is owed. */
  @Prop({ required: true, min: 0 })
  valueMinor!: number;
}

export const PurchaseReturnLineSchema = SchemaFactory.createForClass(PurchaseReturnLine);

/** Goods sent back to the supplier they came from. Takes them out of stock and off what the store owes. */
@Schema({ timestamps: true })
export class PurchaseReturn extends Document {
  @Prop({ required: true, unique: true })
  returnNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Purchase', required: true, index: true })
  purchase!: Types.ObjectId;

  @Prop({ required: true })
  purchaseNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Supplier', required: true, index: true })
  supplier!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: [PurchaseReturnLineSchema], required: true })
  lines!: PurchaseReturnLine[];

  @Prop({ required: true, min: 1 })
  totalMinor!: number;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const PurchaseReturnSchema = SchemaFactory.createForClass(PurchaseReturn);
