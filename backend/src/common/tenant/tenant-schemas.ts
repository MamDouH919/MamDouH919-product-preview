import { Schema } from 'mongoose';
import { User, UserSchema } from '../../auth/schemas/user.schema';
import { RefreshToken, RefreshTokenSchema } from '../../auth/schemas/refresh-schema.schema';
import { Otp, OtpSchema } from '../../auth/schemas/otp.schema';
import { ResetToken, ResetTokenSchema } from '../../auth/schemas/reset-token.schema';
import { Role, RoleSchema } from '../../roles/schemas/role.schema';
import { Category, CategorySchema } from '../../categories/schemas/category.schema';
import { SubCategory, SubCategorySchema } from '../../sub-categories/schemas/sub-category.schema';
import { Section, SectionSchema } from '../../sections/schemas/section.schema';
import { Banner, BannerSchema } from '../../banners/schemas/banner.schema';
import { Subscribe, SubscribeSchema } from '../../subscribe/schemas/subscribe.schema';
import { Setting, SettingSchema } from '../../settings/schemas/setting.schema';
import { Product, ProductSchema } from '../../products/schemas/product.schema';

/**
 * Every model the app uses. All of these are registered on a tenant
 * connection the moment it is opened, so cross-model `.populate()` calls
 * always find the referenced schema on the same connection.
 */
export const tenantSchemas: { name: string; schema: Schema }[] = [
  { name: User.name, schema: UserSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: Otp.name, schema: OtpSchema },
  { name: ResetToken.name, schema: ResetTokenSchema },
  { name: Role.name, schema: RoleSchema },
  { name: Category.name, schema: CategorySchema },
  { name: SubCategory.name, schema: SubCategorySchema },
  { name: Section.name, schema: SectionSchema },
  { name: Banner.name, schema: BannerSchema },
  { name: Subscribe.name, schema: SubscribeSchema },
  { name: Setting.name, schema: SettingSchema },
  { name: Product.name, schema: ProductSchema },
];
