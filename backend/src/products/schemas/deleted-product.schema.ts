import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

/**
 * What a deleted product looked like when it went. Its `_id` is the product's
 * own, so the stock movements and order lines that still point at it can be
 * read back with a name instead of a hole.
 */
@Schema({ timestamps: true, collection: 'deletedproducts' })
export class DeletedProduct extends Document {
  /** The product document as it was, untouched. */
  @Prop({ type: SchemaTypes.Mixed, required: true })
  snapshot!: Record<string, any>;

  @Prop({ type: Date, default: () => new Date() })
  deletedAt!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  deletedBy?: any;
}

export const DeletedProductSchema = SchemaFactory.createForClass(DeletedProduct);
