import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Someone the store buys stock from. What the store owes them is worked out from purchases and payments. */
@Schema({ timestamps: true })
export class Supplier extends Document {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: false, trim: true, lowercase: true })
  email?: string;

  /** Tax registration number, for when the store needs it on its records. */
  @Prop({ required: false, trim: true })
  taxId?: string;

  @Prop({ required: false })
  notes?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index({ name: 1 });
