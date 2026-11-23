import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class LocalizedField {
  @Prop({ required: false })
  ar?: string;

  @Prop({ required: false })
  en?: string;

  @Prop({ required: false })
  es?: string;

}

export const LocalizedFieldSchema = SchemaFactory.createForClass(LocalizedField);
