import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ _id: false })
export class StockTransferLine {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: false })
  variantId?: Types.ObjectId;

  /** Snapshots, so the record stays readable if the product is renamed. */
  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ required: false })
  variantLabel?: string;

  @Prop({ required: false })
  sku?: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;
}

export const StockTransferLineSchema = SchemaFactory.createForClass(StockTransferLine);

/**
 * Units moved from one warehouse to another, in one step. Only quantities
 * move: the stock was the store's before and is after, so its value and the
 * books are untouched. What getting it there cost is recorded as an expense.
 */
@Schema({ timestamps: true })
export class StockTransfer extends Document {
  @Prop({ required: true, unique: true })
  transferNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Warehouse', required: true, index: true })
  from!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Warehouse', required: true, index: true })
  to!: Types.ObjectId;

  @Prop({ type: [StockTransferLineSchema], default: [] })
  lines!: StockTransferLine[];

  @Prop({ default: 0 })
  totalUnits!: number;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const StockTransferSchema = SchemaFactory.createForClass(StockTransfer);
StockTransferSchema.index({ createdAt: -1 });
