import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class LocalizedField {
  @Prop({ required: false })
  ar?: string;

  @Prop({ required: false })
  en?: string;

}

export const LocalizedFieldSchema = SchemaFactory.createForClass(LocalizedField);
