import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import {
  CustomerReviewsController,
  ProductReviewsController,
  ReviewsController,
} from './reviews.controller';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { AuthModule } from '../auth/auth.module';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  // Order matters: `/reviews/product/...` and `/reviews/me/...` must register
  // before the admin `/reviews/:id/...` routes.
  controllers: [ProductReviewsController, CustomerReviewsController, ReviewsController],
  providers: [
    ReviewsService,
    CustomerAuthGuard,
    tenantModelProvider(Review.name, ReviewSchema),
    tenantModelProvider(Product.name, ProductSchema),
    // Read-only here: proving the customer received the product.
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Customer.name, CustomerSchema),
  ],
})
export class ReviewsModule {}
