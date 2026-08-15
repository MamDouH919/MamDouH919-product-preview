import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { Product, ProductVariant } from '../products/schemas/product.schema';
import { StockMovement } from './schemas/stock-movement.schema';
import {
  MOVEMENT_DIRECTION,
  MOVEMENT_TYPE_INFO,
  MovementType,
  MovementTypeInfo,
} from './enums/movement-type.enum';
import { AdjustStockDto, StockTakeDto } from './dto/adjust-stock.dto';
import {
  QueryInventoryDto,
  QueryMovementsDto,
  StockFilter,
} from './dto/query-inventory.dto';

/** One line of the stock report — a product, or one variant of one. */
export interface StockLevel {
  productId: string;
  variantId?: string;
  name: Record<string, string | undefined>;
  variantLabel?: string;
  sku?: string;
  image?: string;
  category?: unknown;
  trackStock: boolean;
  stock: number;
  lowStockThreshold: number;
  status: 'out' | 'low' | 'in_stock' | 'untracked';
  price?: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovement>,
  ) {}

  // ── Writing stock ───────────────────────────────────────────────────────────

  /**
   * The only place stock is allowed to change. Applies the delta with a
   * conditional `$inc` so two concurrent callers can never oversell, then
   * records why it happened.
   */
  async adjust(dto: AdjustStockDto, userId?: string): Promise<StockMovement> {
    const delta = this.signedQuantity(dto.type, dto.quantity);

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);

    if (!product.trackStock) {
      throw new BadRequestException(
        'This product does not track stock. Enable tracking before adjusting it.',
      );
    }

    const hasVariants = (product.variants?.length ?? 0) > 0;
    if (hasVariants && !dto.variantId) {
      throw new BadRequestException(
        'This product has variants — specify which variant to adjust.',
      );
    }
    if (!hasVariants && dto.variantId) {
      throw new BadRequestException('This product has no variants.');
    }

    const balanceAfter = hasVariants
      ? await this.applyVariantDelta(product, dto.variantId!, delta)
      : await this.applyProductDelta(product, delta);

    const variant = hasVariants
      ? product.variants.find((v) => v._id.toString() === dto.variantId)
      : undefined;

    return this.movementModel.create({
      product: new Types.ObjectId(dto.productId),
      variantId: dto.variantId ? new Types.ObjectId(dto.variantId) : undefined,
      variantLabel: variant?.label,
      type: dto.type,
      quantity: delta,
      balanceAfter,
      reason: dto.reason,
      reference: dto.reference,
      user: userId ? new Types.ObjectId(userId) : undefined,
    });
  }

  /**
   * Applies several adjustments as one unit. MongoDB transactions need a
   * replica set, which a plain local install is not, so on failure we undo
   * whatever already landed instead. A rolled-back batch leaves no trace in
   * the ledger because, logically, it never happened.
   */
  async adjustMany(items: AdjustStockDto[], userId?: string): Promise<StockMovement[]> {
    const applied: StockMovement[] = [];

    try {
      for (const item of items) {
        applied.push(await this.adjust(item, userId));
      }
      return applied;
    } catch (error) {
      await this.rollback(applied);
      throw error;
    }
  }

  /** Reconciles recorded stock against a physical count. */
  async stockTake(dto: StockTakeDto, userId?: string): Promise<StockMovement | null> {
    const current = await this.currentStock(dto.productId, dto.variantId);
    const delta = dto.countedQuantity - current;

    if (delta === 0) return null;

    // The count itself says which way the correction goes, so the caller never
    // has to pick a type or work out a sign.
    return this.adjust(
      {
        productId: dto.productId,
        variantId: dto.variantId,
        type: delta > 0 ? MovementType.ADJUSTMENT_IN : MovementType.ADJUSTMENT_OUT,
        quantity: Math.abs(delta),
        reason: dto.reason ?? `Stock take: counted ${dto.countedQuantity}, recorded ${current}`,
      },
      userId,
    );
  }

  /** Undoes movements by writing the inverse `$inc` and dropping the ledger rows. */
  private async rollback(applied: StockMovement[]): Promise<void> {
    for (const movement of applied.reverse()) {
      const inc = movement.variantId
        ? { $inc: { 'variants.$[v].stock': -movement.quantity } }
        : { $inc: { stock: -movement.quantity } };
      const options = movement.variantId
        ? { arrayFilters: [{ 'v._id': movement.variantId }] }
        : {};

      await this.productModel.updateOne({ _id: movement.product }, inc, options).exec();
      await this.movementModel.deleteOne({ _id: movement._id }).exec();
    }
  }

  private async applyProductDelta(product: Product, delta: number): Promise<number> {
    const filter: QueryFilter<Product> = { _id: product._id };
    if (delta < 0 && !product.allowBackorder) {
      filter.stock = { $gte: -delta };
    }

    const updated = await this.productModel
      .findOneAndUpdate(filter, { $inc: { stock: delta } }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new BadRequestException(
        `Not enough stock: ${product.stock} available, ${-delta} requested.`,
      );
    }
    return updated.stock;
  }

  private async applyVariantDelta(
    product: Product,
    variantId: string,
    delta: number,
  ): Promise<number> {
    const variantObjectId = new Types.ObjectId(variantId);
    const variant = product.variants.find((v) => v._id.toString() === variantId);
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found on this product`);

    const filter: QueryFilter<Product> = { _id: product._id };
    if (delta < 0 && !product.allowBackorder) {
      filter.variants = { $elemMatch: { _id: variantObjectId, stock: { $gte: -delta } } };
    } else {
      filter['variants._id'] = variantObjectId;
    }

    const updated = await this.productModel
      .findOneAndUpdate(
        filter,
        { $inc: { 'variants.$[v].stock': delta } },
        { returnDocument: 'after', arrayFilters: [{ 'v._id': variantObjectId }] },
      )
      .exec();

    if (!updated) {
      throw new BadRequestException(
        `Not enough stock for "${variant.label}": ${variant.stock} available, ${-delta} requested.`,
      );
    }

    const updatedVariant = updated.variants.find((v) => v._id.toString() === variantId);
    return updatedVariant?.stock ?? 0;
  }

  /**
   * Quantities arrive as plain positive counts — "12 units" — and the movement
   * type is what decides whether those units come in or go out. Keeping the sign
   * here means no caller can disagree with the ledger about the direction.
   */
  private signedQuantity(type: MovementType, quantity: number): number {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'Quantity must be a whole number greater than zero — the movement type decides the direction.',
      );
    }
    return MOVEMENT_DIRECTION[type] * quantity;
  }

  // ── Reading stock ───────────────────────────────────────────────────────────

  /**
   * The catalogue of movement types with their direction and whether an admin
   * may pick them. Served so the UI renders the same rules the service enforces
   * instead of keeping its own copy of them.
   */
  getMovementTypes(): MovementTypeInfo[] {
    return MOVEMENT_TYPE_INFO;
  }

  /** Stock of one product or variant right now. */
  async currentStock(productId: string, variantId?: string): Promise<number> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    if (!variantId) return product.stock ?? 0;

    const variant = product.variants.find((v) => v._id.toString() === variantId);
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found on this product`);
    return variant.stock ?? 0;
  }

  /**
   * Whether a basket can be fulfilled. Used by checkout before any stock moves,
   * so the customer gets a clear list of what is short rather than a failure
   * halfway through.
   */
  async checkAvailability(
    items: { productId: string; variantId?: string; quantity: number }[],
  ): Promise<{ available: boolean; shortages: { productId: string; variantId?: string; requested: number; available: number }[] }> {
    const shortages: { productId: string; variantId?: string; requested: number; available: number }[] = [];

    for (const item of items) {
      const product = await this.productModel.findById(item.productId).exec();
      if (!product) {
        shortages.push({ ...item, requested: item.quantity, available: 0 });
        continue;
      }
      if (!product.trackStock || product.allowBackorder) continue;

      const available = item.variantId
        ? (product.variants.find((v) => v._id.toString() === item.variantId)?.stock ?? 0)
        : (product.stock ?? 0);

      if (available < item.quantity) {
        shortages.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available,
        });
      }
    }

    return { available: shortages.length === 0, shortages };
  }

  /** The stock report: one row per product, or per variant when it has them. */
  async getLevels(query: QueryInventoryDto): Promise<StockLevel[]> {
    const filter: QueryFilter<Product> = {};
    if (query.categoryId) filter.category = new Types.ObjectId(query.categoryId);
    if (query.search) {
      const term = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [{ 'name.en': term }, { 'name.ar': term }, { sku: term }];
    }

    const products = await this.productModel
      .find(filter)
      .populate('category', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();

    const rows = products.flatMap((product) =>
      product.variants?.length
        ? product.variants.map((variant) => this.toLevel(product, variant))
        : [this.toLevel(product)],
    );

    return this.filterByStatus(rows, query.status);
  }

  async getLowStock(): Promise<StockLevel[]> {
    const rows = await this.getLevels({});
    return rows.filter((row) => row.status === 'low' || row.status === 'out');
  }

  async getSummary(): Promise<{
    trackedItems: number;
    totalUnits: number;
    stockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const rows = await this.getLevels({});
    const tracked = rows.filter((row) => row.trackStock);

    return {
      trackedItems: tracked.length,
      totalUnits: tracked.reduce((sum, row) => sum + row.stock, 0),
      stockValue: tracked.reduce((sum, row) => sum + row.stock * (row.price ?? 0), 0),
      lowStockCount: tracked.filter((row) => row.status === 'low').length,
      outOfStockCount: tracked.filter((row) => row.status === 'out').length,
    };
  }

  async getMovements(query: QueryMovementsDto): Promise<{
    data: StockMovement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    // Cast explicitly — a plain string never matches a stored ObjectId here.
    const filter: QueryFilter<StockMovement> = {};
    if (query.productId) filter.product = new Types.ObjectId(query.productId);
    if (query.variantId) filter.variantId = new Types.ObjectId(query.variantId);
    if (query.type) filter.type = query.type;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const [data, total] = await Promise.all([
      this.movementModel
        .find(filter)
        .populate('product', 'name slug images sku')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.movementModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private toLevel(product: Product, variant?: ProductVariant): StockLevel {
    const stock = variant ? (variant.stock ?? 0) : (product.stock ?? 0);
    const threshold = product.lowStockThreshold ?? 0;

    let status: StockLevel['status'];
    if (!product.trackStock) status = 'untracked';
    else if (stock <= 0) status = 'out';
    else if (threshold > 0 && stock <= threshold) status = 'low';
    else status = 'in_stock';

    return {
      productId: product._id!.toString(),
      variantId: variant?._id?.toString(),
      name: product.name as unknown as Record<string, string | undefined>,
      variantLabel: variant?.label,
      sku: variant?.sku ?? product.sku,
      image: product.images?.[0],
      category: product.category,
      trackStock: product.trackStock,
      stock,
      lowStockThreshold: threshold,
      status,
      price: variant?.price ?? product.price,
    };
  }

  private filterByStatus(rows: StockLevel[], status?: StockFilter): StockLevel[] {
    switch (status) {
      case StockFilter.LOW:
        return rows.filter((row) => row.status === 'low');
      case StockFilter.OUT:
        return rows.filter((row) => row.status === 'out');
      case StockFilter.IN_STOCK:
        return rows.filter((row) => row.status === 'in_stock');
      default:
        return rows;
    }
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
