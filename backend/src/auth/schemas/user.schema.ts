import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ required: false, type: SchemaTypes.ObjectId })
  roleId!: Types.ObjectId;

  @Prop({ default: false })
  isSuper!: boolean;

  /** A switched-off account can't sign in and its sessions end; nothing else about it is lost. */
  @Prop({ default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
