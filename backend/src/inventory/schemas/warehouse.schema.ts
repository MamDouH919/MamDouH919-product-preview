import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

/**
 * A place stock is kept. Orders are filled from the one main warehouse; the
 * others hold stock that reaches customers by being transferred to it first.
 *
 * A warehouse that has held stock is never deleted, only closed, so the
 * movements that name it keep pointing somewhere.
 */
@Schema({ timestamps: true })
export class Warehouse extends Document {
  @Prop({ required: true, type: LocalizedFieldSchema })
  name!: LocalizedField;

  /** Short unique code, shown where the name doesn't fit (e.g. "MAIN", "RUH"). */
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ required: false, trim: true })
  address?: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  /** Exactly one warehouse is main: the one sales take stock from. */
  @Prop({ default: false })
  isMain!: boolean;

  /** A closed warehouse takes no new stock; it must be empty to be closed. */
  @Prop({ default: true })
  isActive!: boolean;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);

/** At most one main warehouse, enforced by the database rather than by hope. */
WarehouseSchema.index({ isMain: 1 }, { unique: true, partialFilterExpression: { isMain: true }, name: 'one_main' });
