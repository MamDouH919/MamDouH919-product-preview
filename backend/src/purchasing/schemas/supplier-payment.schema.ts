import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

@Schema({ _id: false })
export class SupplierPaymentAllocation {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Purchase', required: true })
  purchase!: Types.ObjectId;

  @Prop({ required: true })
  purchaseNumber!: number;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;
}

export const SupplierPaymentAllocationSchema = SchemaFactory.createForClass(SupplierPaymentAllocation);

/**
 * Cash paid to a supplier. Settles their oldest unpaid purchases first; the
 * allocations say which, so each purchase knows what is still owed on it.
 */
@Schema({ timestamps: true })
export class SupplierPayment extends Document {
  @Prop({ required: true, unique: true })
  paymentNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Supplier', required: true, index: true })
  supplier!: Types.ObjectId;

  /** When it was paid — the date it reports in. */
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ type: [SupplierPaymentAllocationSchema], default: [] })
  allocations!: SupplierPaymentAllocation[];

  @Prop({ required: false })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);
