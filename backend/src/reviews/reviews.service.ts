import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Review, ReviewStatus } from './schemas/review.schema';
import { Product } from '../products/schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Customer } from '../customers/schemas/customer.schema';
import {
  CreateReviewDto,
  QueryProductReviewsDto,
  QueryReviewsDto,
  UpdateReviewDto,
} from './dto/review.dto';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Query strings reach the service unconverted — see QueryReviewsDto. */
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

/** "Sara Ahmed Ali" → "Sara A." — enough to feel real, not enough to identify anyone. */
export function publicAuthorName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const initial = rest.length ? ` ${rest[rest.length - 1][0]}.` : '';
  return `${first ?? ''}${initial}`.trim() || 'Customer';
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Approved reviews per star, keyed "1" … "5". */
  distribution: Record<string, number>;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
  ) {}

  // ── Storefront ──────────────────────────────────────────────────────────────

  /** Approved reviews of one product, newest first, with the star breakdown. */
  async findForProduct(productId: string, query: QueryProductReviewsDto) {
    const product = this.toObjectId(productId, 'Product not found');
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 10;
    const filter = { product, status: ReviewStatus.APPROVED };

    const [data, total, summary] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('authorName rating comment reply repliedAt createdAt')
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.summarize(product),
    ]);

    return { data, total, page, limit, summary };
  }

  /**
   * Whether the signed-in customer may review a product, and their review if
   * they already wrote one. Only a delivered order counts as having bought it,
   * so every public review is from someone who actually received the item.
   */
  async eligibility(customerId: string, productId: string) {
    const product = this.toObjectId(productId, 'Product not found');
    const customer = new Types.ObjectId(customerId);

    const [purchased, review] = await Promise.all([
      this.hasReceived(customer, product),
      this.reviewModel.findOne({ product, customer }).lean().exec(),
    ]);

    return { canReview: purchased && !review, hasPurchased: purchased, review };
  }

  async create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    const product = this.toObjectId(dto.productId, 'Product not found');
    const customerOid = new Types.ObjectId(customerId);

    const [customer, productExists, purchased] = await Promise.all([
      this.customerModel.findById(customerOid).select('name isActive').exec(),
      this.productModel.exists({ _id: product, isActive: true }),
      this.hasReceived(customerOid, product),
    ]);

    // A blocked customer keeps their history but can't add to it.
    if (!customer?.isActive) throw new ForbiddenException('This account cannot post reviews');
    if (!productExists) throw new NotFoundException('Product not found');
    if (!purchased) {
      throw new ForbiddenException('Only customers who received this product can review it');
    }

    try {
      return await this.reviewModel.create({
        product,
        customer: customerOid,
        authorName: publicAuthorName(customer.name),
        rating: dto.rating,
        comment: dto.comment || undefined,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw error;
    }
  }

  /** Editing sends the review back to moderation, so an approved one can't be rewritten unseen. */
  async updateMine(customerId: string, id: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.reviewModel
      .findOne({ _id: this.toObjectId(id, 'Review not found'), customer: new Types.ObjectId(customerId) })
      .exec();
    if (!review) throw new NotFoundException('Review not found');

    const wasApproved = review.status === ReviewStatus.APPROVED;
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment || undefined;
    review.status = ReviewStatus.PENDING;
    await review.save();

    if (wasApproved) await this.refreshProductRating(review.product);
    return review;
  }

  async removeMine(customerId: string, id: string): Promise<Review> {
    const review = await this.reviewModel
      .findOneAndDelete({ _id: this.toObjectId(id, 'Review not found'), customer: new Types.ObjectId(customerId) })
      .exec();
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === ReviewStatus.APPROVED) await this.refreshProductRating(review.product);
    return review;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async findAll(query: QueryReviewsDto) {
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 20;

    const filter: QueryFilter<Review> = {};
    if (query.status) filter.status = query.status;
    if (query.productId) filter.product = new Types.ObjectId(query.productId);
    if (query.rating) filter.rating = num(query.rating);
    const term = query.search?.trim();
    if (term) {
      const pattern = new RegExp(escapeRegex(term), 'i');
      filter.$or = [{ comment: pattern }, { authorName: pattern }];
    }

    const [data, total, counts] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('product', 'name slug images')
        .populate('customer', 'name email')
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.reviewModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(ReviewStatus).map((status) => [status, 0]),
    ) as Record<ReviewStatus, number>;
    for (const row of counts) statusCounts[row._id as ReviewStatus] = row.count;

    return { data, total, page, limit, statusCounts };
  }

  async setStatus(id: string, status: ReviewStatus): Promise<Review> {
    const review = await this.reviewModel
      .findByIdAndUpdate(this.toObjectId(id, 'Review not found'), { status }, { returnDocument: 'after' })
      .exec();
    if (!review) throw new NotFoundException('Review not found');
    await this.refreshProductRating(review.product);
    return review;
  }

  async reply(id: string, reply: string): Promise<Review> {
    const update = reply
      ? { $set: { reply, repliedAt: new Date() } }
      : { $unset: { reply: 1, repliedAt: 1 } };
    const review = await this.reviewModel
      .findByIdAndUpdate(this.toObjectId(id, 'Review not found'), update, { returnDocument: 'after' })
      .exec();
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async remove(id: string): Promise<Review> {
    const review = await this.reviewModel
      .findByIdAndDelete(this.toObjectId(id, 'Review not found'))
      .exec();
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === ReviewStatus.APPROVED) await this.refreshProductRating(review.product);
    return review;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private hasReceived(customer: Types.ObjectId, product: Types.ObjectId): Promise<boolean> {
    return this.orderModel
      .exists({ customer, status: OrderStatus.DELIVERED, 'items.product': product })
      .then(Boolean);
  }

  private async summarize(product: Types.ObjectId): Promise<RatingSummary> {
    const rows: { _id: number; count: number }[] = await this.reviewModel
      .aggregate([
        { $match: { product, status: ReviewStatus.APPROVED } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ])
      .exec();

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let count = 0;
    let sum = 0;
    for (const row of rows) {
      distribution[String(row._id)] = row.count;
      count += row.count;
      sum += row._id * row.count;
    }
    return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution };
  }

  /**
   * Copies the approved average onto the product, so cards, search results and
   * structured data read it without touching reviews. Recomputed from scratch
   * every time rather than nudged, so it can never drift.
   */
  private async refreshProductRating(product: Types.ObjectId): Promise<void> {
    const { average, count } = await this.summarize(product);
    await this.productModel
      .updateOne({ _id: product }, { ratingAverage: average, ratingCount: count })
      .exec();
  }

  private toObjectId(id: string, notFoundMessage: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(notFoundMessage);
    return new Types.ObjectId(id);
  }
}
