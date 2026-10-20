import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, QueryFilter, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { formatMinor } from '../common/money/money';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { isValued, issue, issueAt, Pool, receive, unitCost, UnvaluedStockError } from './valuation';
import { Product, ProductVariant } from '../products/schemas/product.schema';
import { StockMovement } from './schemas/stock-movement.schema';
import {
  MANUAL_MOVEMENT_TYPES,
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

/**
 * The cost-of-goods-sold side of a costing variance. Positive: the units sold
 * short cost more than estimated (or a pool emptied with value left), so COGS
 * goes up; negative is the reverse. The inventory side needs no line of its
 * own: a movement's `valueMinor` is already net of the variance.
 */
export function varianceLines(varianceMinor: number) {
  if (!varianceMinor) return [];
  return [{ account: ACCOUNT.COGS, debitMinor: Math.max(varianceMinor, 0), creditMinor: Math.max(-varianceMinor, 0) }];
}

/** Debit (positive) or credit (negative) of an account, as one journal line. */
export function signedLine(account: string, amountMinor: number) {
  return { account, debitMinor: Math.max(amountMinor, 0), creditMinor: Math.max(-amountMinor, 0) };
}

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
  /** Whether the stock has a cost yet. */
  valued: boolean;
  /** Cost of the stock on hand (minor units); null until it has one. */
  valueMinor: number | null;
  /** Average cost of one unit; null until the stock has a cost. */
  unitCostMinor: number | null;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovement>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  // ── Writing stock ───────────────────────────────────────────────────────────

  /**
   * The only place stock is allowed to change. Applies the delta with a
   * conditional `$inc` so two concurrent callers can never oversell, moves
   * the stock's value with it (moving weighted average), then records why it
   * happened. Runs in the caller's transaction (`session`: a checkout, a
   * refund, a purchase) or in one of its own.
   *
   * `valueMinor` is the known total cost of units coming in (a purchase, or
   * goods back at what they were sold out at) or going out at a stated cost
   * (goods back to the supplier). Left out, units in take the current unit
   * cost and units out the average.
   *
   * Manual corrections (damage, stock-take differences) post their value to
   * the books here. Every other movement is posted by the business event
   * that caused it, in the same transaction.
   */
  async adjust(
    dto: AdjustStockDto,
    userId?: string,
    session?: ClientSession,
    valueMinor?: number,
  ): Promise<StockMovement> {
    if (!session) return withTransaction(this.connection, (s) => this.adjust(dto, userId, s, valueMinor));
    const delta = this.signedQuantity(dto.type, dto.quantity);

    const product = await this.productModel.findById(dto.productId).session(session).exec();
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
    const variant = hasVariants
      ? product.variants.find((v) => v._id.toString() === dto.variantId)
      : undefined;
    if (hasVariants && !variant) throw new NotFoundException(`Variant ${dto.variantId} not found on this product`);

    const pool = this.poolOf(product, variant);
    let moved: { next: Pool; valueMinor?: number; estimated: boolean; varianceMinor: number };
    try {
      if (delta > 0) {
        const known = valueMinor ?? (isValued(pool) ? dto.quantity * (unitCost(pool) ?? 0) : undefined);
        if (known === undefined) {
          moved = { next: { ...pool, qty: pool.qty + delta }, estimated: false, varianceMinor: 0 };
        } else {
          const received = receive(pool, delta, known);
          // What the stock's value really changes by: what came in, less the part
          // that settles an earlier shortfall's estimate (variance, booked to COGS).
          moved = { next: received.next, valueMinor: known - received.varianceMinor, estimated: false, varianceMinor: received.varianceMinor };
        }
      } else if (valueMinor !== undefined) {
        const out = issueAt(pool, -delta, valueMinor);
        moved = {
          next: out.next,
          valueMinor: isValued(pool) ? -(valueMinor + out.varianceMinor) : undefined,
          estimated: false,
          varianceMinor: out.varianceMinor,
        };
      } else {
        const out = issue(pool, -delta);
        moved = { next: out.next, valueMinor: out.costMinor === null ? undefined : -out.costMinor, estimated: out.estimated, varianceMinor: 0 };
      }
    } catch (error) {
      if (error instanceof UnvaluedStockError) throw new BadRequestException(error.message);
      throw error;
    }

    const balanceAfter = hasVariants
      ? await this.applyVariantDelta(product, dto.variantId!, delta, moved.next, session)
      : await this.applyProductDelta(product, delta, moved.next, session);

    const [movement] = await this.movementModel.create(
      [
        {
          product: new Types.ObjectId(dto.productId),
          variantId: dto.variantId ? new Types.ObjectId(dto.variantId) : undefined,
          variantLabel: variant?.label,
          type: dto.type,
          quantity: delta,
          balanceAfter,
          valueMinor: moved.valueMinor,
          valueAfterMinor: moved.next.valueMinor ?? undefined,
          costEstimated: moved.estimated,
          varianceMinor: moved.varianceMinor || undefined,
          reason: dto.reason,
          reference: dto.reference,
          user: userId ? new Types.ObjectId(userId) : undefined,
        },
      ],
      { session },
    );

    if (MANUAL_MOVEMENT_TYPES.includes(dto.type)) await this.postCorrection(movement, session, userId);
    return movement;
  }

  /**
   * Gives stock with no cost its first one: what is on hand is worth
   * `unitCostMinor` each from now on. Books it as opening inventory against
   * owner equity — it was bought before the books began. Only for stock that
   * has no cost yet; after that, costs come from purchases.
   */
  async setOpeningCost(
    productId: string,
    variantId: string | undefined,
    unitCostMinor: number,
    userId?: string,
  ): Promise<StockMovement> {
    if (!Number.isSafeInteger(unitCostMinor) || unitCostMinor < 0) throw new BadRequestException('The unit cost must be 0 or more');
    return withTransaction(this.connection, async (session) => {
      const product = await this.productModel.findById(productId).session(session).exec();
      if (!product) throw new NotFoundException(`Product ${productId} not found`);
      const variant = variantId ? product.variants.find((v) => v._id.toString() === variantId) : undefined;
      if (variantId && !variant) throw new NotFoundException(`Variant ${variantId} not found on this product`);
      if (!variantId && product.variants?.length) throw new BadRequestException('This product has variants — set the cost of each');

      const pool = this.poolOf(product, variant);
      if (isValued(pool)) throw new ConflictException('This stock already has a cost; costs now come from purchases');

      // Units sold short while uncosted stay uncosted; only what is on the shelf gets this cost.
      const valueMinor = Math.max(pool.qty, 0) * unitCostMinor;
      const set = variant
        ? { 'variants.$[v].inventoryValueMinor': valueMinor, 'variants.$[v].lastUnitCostMinor': unitCostMinor }
        : { inventoryValueMinor: valueMinor, lastUnitCostMinor: unitCostMinor };
      await this.productModel
        .updateOne({ _id: product._id }, { $set: set }, { session, ...(variant ? { arrayFilters: [{ 'v._id': variant._id }] } : {}) })
        .exec();

      const [movement] = await this.movementModel.create(
        [
          {
            product: product._id,
            variantId: variant?._id,
            variantLabel: variant?.label,
            type: MovementType.COST_SET,
            quantity: 0,
            balanceAfter: pool.qty,
            valueMinor,
            valueAfterMinor: valueMinor,
            reason: `Opening cost ${formatMinor(unitCostMinor)} per unit`,
            user: userId ? new Types.ObjectId(userId) : undefined,
          },
        ],
        { session },
      );
      await this.journal.post(
        {
          date: new Date(),
          source: { type: 'stock_movement', id: movement._id as Types.ObjectId, event: 'opening_cost' },
          lines: [
            { account: ACCOUNT.INVENTORY, debitMinor: valueMinor },
            { account: ACCOUNT.EQUITY, creditMinor: valueMinor },
          ],
          memo: `Opening stock value, ${pool.qty} unit(s)`,
          createdBy: userId,
        },
        session,
      );
      return movement;
    });
  }

  /** The value a damage or stock-take correction moved, posted to inventory losses. */
  private async postCorrection(movement: StockMovement, session: ClientSession, userId?: string) {
    const value = movement.valueMinor ?? 0;
    const variance = movement.varianceMinor ?? 0;
    if (!value && !variance) return;
    await this.journal.post(
      {
        date: new Date(),
        source: { type: 'stock_movement', id: movement._id as Types.ObjectId, event: movement.type },
        lines: [
          // Units out: inventory down, losses up. Units in: the reverse, at what
          // they came in at — part of which may settle a shortfall (variance).
          signedLine(ACCOUNT.INVENTORY, value),
          signedLine(ACCOUNT.INVENTORY_LOSSES, -(value + variance)),
          ...varianceLines(variance),
        ],
        memo: `Stock ${movement.type.replace('_', ' ')}${movement.reason ? `: ${movement.reason}` : ''}`,
        createdBy: userId,
      },
      session,
    );
  }

  /** Quantity and value of one product's or variant's stock. */
  private poolOf(product: Product, variant?: ProductVariant): Pool {
    const source = variant ?? product;
    return {
      qty: source.stock ?? 0,
      valueMinor: source.inventoryValueMinor ?? null,
      lastUnitCostMinor: source.lastUnitCostMinor ?? null,
    };
  }

  /**
   * Applies several adjustments as one unit: inside the caller's transaction
   * when given `session`, otherwise in a transaction of its own. Either every
   * line lands or none does, and a refused batch leaves no ledger rows behind
   * because none were ever committed.
   */
  async adjustMany(items: AdjustStockDto[], userId?: string, session?: ClientSession): Promise<StockMovement[]> {
    const run = async (s: ClientSession) => {
      const applied: StockMovement[] = [];
      for (const item of items) applied.push(await this.adjust(item, userId, s));
      return applied;
    };
    return session ? run(session) : withTransaction(this.connection, run);
  }

  /** Whether the ledger holds any movement for a product — its stock history. */
  async hasMovements(productId: string | Types.ObjectId): Promise<boolean> {
    return !!(await this.movementModel.exists({ product: new Types.ObjectId(productId) }).exec());
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

  private async applyProductDelta(product: Product, delta: number, next: Pool, session: ClientSession): Promise<number> {
    const filter: QueryFilter<Product> = { _id: product._id };
    if (delta < 0 && !product.allowBackorder) {
      filter.stock = { $gte: -delta };
    }

    const updated = await this.productModel
      .findOneAndUpdate(
        filter,
        { $inc: { stock: delta }, ...(next.valueMinor === null ? {} : { $set: this.valueFields('', next) }) },
        { returnDocument: 'after', session },
      )
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
    next: Pool,
    session: ClientSession,
  ): Promise<number> {
    const variantObjectId = new Types.ObjectId(variantId);
    const variant = product.variants.find((v) => v._id.toString() === variantId)!;

    const filter: QueryFilter<Product> = { _id: product._id };
    if (delta < 0 && !product.allowBackorder) {
      filter.variants = { $elemMatch: { _id: variantObjectId, stock: { $gte: -delta } } };
    } else {
      filter['variants._id'] = variantObjectId;
    }

    const updated = await this.productModel
      .findOneAndUpdate(
        filter,
        {
          $inc: { 'variants.$[v].stock': delta },
          ...(next.valueMinor === null ? {} : { $set: this.valueFields('variants.$[v].', next) }),
        },
        { returnDocument: 'after', arrayFilters: [{ 'v._id': variantObjectId }], session },
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
   * The value written beside the `$inc` on stock. Computed from the stock read
   * in this transaction; a concurrent change to the same product makes one of
   * the two transactions retry, so the value never drifts from the units.
   */
  private valueFields(prefix: string, next: Pool) {
    return {
      [`${prefix}inventoryValueMinor`]: next.valueMinor,
      [`${prefix}lastUnitCostMinor`]: next.lastUnitCostMinor,
    };
  }

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
    costValueMinor: number;
    uncostedItems: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const rows = await this.getLevels({});
    const tracked = rows.filter((row) => row.trackStock);

    return {
      trackedItems: tracked.length,
      totalUnits: tracked.reduce((sum, row) => sum + row.stock, 0),
      // At selling prices — what the stock would fetch, not what it cost.
      stockValue: tracked.reduce((sum, row) => sum + row.stock * (row.price ?? 0), 0),
      // At cost — what the books carry as inventory. Uncosted stock isn't in it.
      costValueMinor: tracked.reduce((sum, row) => sum + (row.valueMinor ?? 0), 0),
      uncostedItems: tracked.filter((row) => !row.valued && row.stock > 0).length,
      lowStockCount: tracked.filter((row) => row.status === 'low').length,
      outOfStockCount: tracked.filter((row) => row.status === 'out').length,
    };
  }

  /**
   * Inventory valuation: every tracked item with its units, unit cost and
   * value at cost, and what has no cost yet. The value total is what the
   * books carry as inventory (account 1300).
   */
  async getValuation() {
    const rows = (await this.getLevels({})).filter((row) => row.trackStock);
    return {
      asOf: new Date(),
      rows,
      totalValueMinor: rows.reduce((t, r) => t + (r.valueMinor ?? 0), 0),
      totalUnits: rows.reduce((t, r) => t + r.stock, 0),
      uncosted: rows.filter((r) => !r.valued && r.stock > 0).map((r) => ({ productId: r.productId, variantId: r.variantId, name: r.name, variantLabel: r.variantLabel, stock: r.stock })),
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
    const pool = this.poolOf(product, variant);
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
      valued: isValued(pool),
      valueMinor: pool.valueMinor,
      unitCostMinor: unitCost(pool),
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
