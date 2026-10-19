import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

/**
 * A governorate / state. Seeded per country when a super admin picks one in
 * settings — never typed by hand — so every store in a country shares the
 * same names and the price list only has to say what delivery costs.
 */
@Schema({ timestamps: true })
export class Zone extends Document {
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  @Prop({ required: true, index: true })
  country!: string;

  /** Stable seed key, e.g. "EG-KB". */
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ default: 0 })
  sort!: number;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);

/** A city / district inside a zone — what a customer actually picks. */
@Schema({ timestamps: true })
export class SubZone extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Zone', required: true, index: true })
  zone!: Types.ObjectId;

  /** Stable seed key, e.g. "EG-KB-benha". */
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ default: 0 })
  sort!: number;
}

export const SubZoneSchema = SchemaFactory.createForClass(SubZone);
