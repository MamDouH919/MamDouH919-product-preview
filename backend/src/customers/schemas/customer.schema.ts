import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Addresses are embedded rather than a collection of their own: they are only
 * ever read through their owner, and an order copies the one it shipped to
 * instead of referencing it, so nothing outside this document points at them.
 */
@Schema({ timestamps: true })
export class Address {
  _id!: Types.ObjectId;

  /** What the customer calls it — "Home", "Work". */
  @Prop({ required: false })
  label?: string;

  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: false })
  area?: string;

  @Prop({ required: true })
  street!: string;

  @Prop({ required: false })
  building?: string;

  @Prop({ required: false })
  notes?: string;

  @Prop({ default: false })
  isDefault!: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

/**
 * Storefront customers. Deliberately a separate collection from `User`, which
 * is the admin identity: `User` carries `roleId` and `isSuper`, and the
 * authorization guard reads permissions off that role. Sharing one collection
 * would make "can this account reach the dashboard?" a question of role
 * configuration rather than of construction.
 */
@Schema({ timestamps: true })
export class Customer extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  /**
   * Absent on a guest — someone checkout created a record for by email, who
   * hasn't set a password yet. They activate the account through an emailed
   * link (or straight from their order confirmation), like Shopify's invites.
   */
  @Prop({ required: false })
  password?: string;

  @Prop({ required: false })
  phone?: string;

  /** Reserved for optional email verification — ordering does not require it. */
  @Prop({ default: false })
  isVerified!: boolean;

  /** Created by a guest checkout and not activated yet. */
  @Prop({ default: false })
  isGuest!: boolean;

  /** Lets an admin block an account without deleting its order history. */
  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Address[];

  /** Saved products, most recent last. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  wishlist!: Types.ObjectId[];
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
