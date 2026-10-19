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
import { StockMovement, StockMovementSchema } from '../../inventory/schemas/stock-movement.schema';
import { Customer, CustomerSchema } from '../../customers/schemas/customer.schema';
import { Order, OrderSchema } from '../../orders/schemas/order.schema';
import { Counter, CounterSchema } from '../../orders/schemas/counter.schema';
import { Coupon, CouponSchema } from '../../coupons/schemas/coupon.schema';
import { Page, PageSchema } from '../../pages/schemas/page.schema';
import { Zone, ZoneSchema, SubZone, SubZoneSchema } from '../../price-list/schemas/zone.schema';
import { DeliveryPrice, DeliveryPriceSchema } from '../../price-list/schemas/delivery-price.schema';
import { ReturnRequest, ReturnRequestSchema } from '../../returns/schemas/return-request.schema';
import { ActivityLog, ActivityLogSchema } from '../../activity-log/schemas/activity-log.schema';
import { Review, ReviewSchema } from '../../reviews/schemas/review.schema';
import { MailSetting, MailSettingSchema } from '../../mail/schemas/mail-setting.schema';
import {
  CustomerRefreshToken,
  CustomerRefreshTokenSchema,
  CustomerResetToken,
  CustomerResetTokenSchema,
} from '../../customer-auth/schemas/customer-token.schema';

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
  { name: StockMovement.name, schema: StockMovementSchema },
  { name: Customer.name, schema: CustomerSchema },
  { name: CustomerRefreshToken.name, schema: CustomerRefreshTokenSchema },
  { name: CustomerResetToken.name, schema: CustomerResetTokenSchema },
  { name: Order.name, schema: OrderSchema },
  { name: Counter.name, schema: CounterSchema },
  { name: Coupon.name, schema: CouponSchema },
  { name: Page.name, schema: PageSchema },
  { name: MailSetting.name, schema: MailSettingSchema },
  { name: Zone.name, schema: ZoneSchema },
  { name: SubZone.name, schema: SubZoneSchema },
  { name: DeliveryPrice.name, schema: DeliveryPriceSchema },
  { name: Review.name, schema: ReviewSchema },
  { name: ReturnRequest.name, schema: ReturnRequestSchema },
  { name: ActivityLog.name, schema: ActivityLogSchema },
];
