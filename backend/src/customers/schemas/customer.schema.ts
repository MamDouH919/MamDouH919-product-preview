import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

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

  /** The price-list zone and subzone, chosen from where the store delivers. */
  @Prop({ type: Types.ObjectId, ref: 'Zone', required: false })
  zone?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubZone', required: false })
  subZone?: Types.ObjectId;

  /** Names copied in when saved, so showing an address needs no lookup. */
  @Prop({ type: LocalizedFieldSchema, required: false })
  zoneName?: LocalizedField;

  @Prop({ type: LocalizedFieldSchema, required: false })
  subZoneName?: LocalizedField;

  /** Free-text city from before the price list; new addresses use the subzone. */
  @Prop({ required: false })
  city?: string;

  /** Neighbourhood / district inside the subzone. */
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

/** What an address holds apart from its id and the owner's preferences. */
export type AddressFields = Omit<Address, '_id' | 'label' | 'isDefault'>;

export const AddressSchema = SchemaFactory.createForClass(Address);

/** One basket line as saved for a signed-in customer — what and how many, never a price. */
@Schema({ _id: false })
export class SavedCartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false })
  variantId?: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;
}

export const SavedCartItemSchema = SchemaFactory.createForClass(SavedCartItem);

/**
 * A signed-in customer's basket, mirrored from the browser so it follows them
 * across devices and so an abandoned one can be followed up by email.
 */
@Schema({ _id: false })
export class SavedCart {
  @Prop({ type: [SavedCartItemSchema], default: [] })
  items!: SavedCartItem[];

  /** Storefront language when it last changed — the language a reminder is written in. */
  @Prop({ required: false })
  locale?: string;

  /** When the contents last changed. Re-saving the same lines doesn't move it. */
  @Prop({ type: Date, required: true })
  updatedAt!: Date;

  /** When a reminder went out. One per change: older than `updatedAt` means it's due again. */
  @Prop({ type: Date, required: false })
  remindedAt?: Date;
}

export const SavedCartSchema = SchemaFactory.createForClass(SavedCart);

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

  /** Left out of every query unless asked for, so profile responses stay small. */
  @Prop({ type: SavedCartSchema, required: false, select: false })
  cart?: SavedCart;

  /** Cleared by the opt-out link in a reminder email. */
  @Prop({ default: true })
  cartReminders!: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// Finds carts due a reminder without scanning every customer.
CustomerSchema.index({ 'cart.updatedAt': 1 }, { sparse: true });
