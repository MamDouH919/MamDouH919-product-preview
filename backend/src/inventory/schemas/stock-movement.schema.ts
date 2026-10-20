import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { MovementType } from '../enums/movement-type.enum';

/**
 * An append-only ledger of every stock change. The `stock` number on a product
 * is a running total of these rows — this collection is what makes it possible
 * to answer *why* the count is what it is.
 *
 * Nothing here is ever updated or deleted. A mistake is corrected by writing
 * an opposing ADJUSTMENT, not by editing history.
 */
@Schema({ timestamps: true })
export class StockMovement extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true, index: true })
  product!: Types.ObjectId;

  /** Set when the movement targets one variant; absent for product-level stock. */
  @Prop({ type: SchemaTypes.ObjectId, required: false })
  variantId?: Types.ObjectId;

  /** Snapshot of the variant label, so the ledger stays readable if it is renamed. */
  @Prop({ required: false })
  variantLabel?: string;

  @Prop({ type: String, enum: MovementType, required: true })
  type!: MovementType;

  /** Signed: positive adds stock, negative removes it. */
  @Prop({ required: true })
  quantity!: number;

  /** Stock level after this movement was applied — the audit anchor. */
  @Prop({ required: true })
  balanceAfter!: number;

  @Prop({ required: false })
  reason?: string;

  /** Free-form link to whatever caused this — an order id, a supplier invoice. */
  @Prop({ required: false })
  reference?: string;

  /**
   * Value moved, signed like `quantity` (minor units). Unset for stock with no
   * cost yet. Summed per product, these give its inventory value.
   */
  @Prop({ type: Number, required: false })
  valueMinor?: number;

  /** Inventory value after this movement — the valuation's audit anchor, like `balanceAfter`. */
  @Prop({ type: Number, required: false })
  valueAfterMinor?: number;

  /** Part of the units went out short and were costed at the last unit cost. */
  @Prop({ default: false })
  costEstimated!: boolean;

  /** A receipt that settled an earlier shortfall: true cost less its estimate, booked to COGS. */
  @Prop({ type: Number, required: false })
  varianceMinor?: number;

  /** The admin who did it. Absent when the system moved stock (e.g. a sale). */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  user?: Types.ObjectId;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

StockMovementSchema.index({ product: 1, createdAt: -1 });
StockMovementSchema.index({ createdAt: -1 });
