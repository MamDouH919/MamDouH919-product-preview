import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Named sequences. A single `$inc` on one of these is atomic, so two orders
 * placed at the same instant can never be handed the same number.
 */
@Schema({ versionKey: false })
export class Counter extends Document {
  /** The sequence name, e.g. "order". */
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
