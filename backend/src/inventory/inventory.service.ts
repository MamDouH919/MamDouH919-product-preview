import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, QueryFilter, Model, Types } from 'mongoose';
import { STORE_HOST, TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { afterCommit, withTransaction } from '../common/tenant/with-transaction';
import { DEFAULT_MINOR_UNIT, formatMinor } from '../common/money/money';
import { PriceChangeRecorder } from '../common/tenant/price-change-recorder';
import type { PriceSource } from '../common/tenant/price-change-store';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { isValued, issue, issueAt, Pool, receive, unitCost, UnvaluedStockError } from './valuation';
import { preorderUnits, Product, ProductVariant, totalUnits, WarehouseStock } from '../products/schemas/product.schema';
import { StockMovement } from './schemas/stock-movement.schema';
import { StockTransfer } from './schemas/stock-transfer.schema';
import { Warehouse } from './schemas/warehouse.schema';
import { Counter } from '../orders/schemas/counter.schema';
import { WarehousesService } from './warehouses.service';
import { CreateTransferDto, QueryTransfersDto } from './dto/warehouse.dto';
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
import { memo } from '../finance/journal-memo';

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

/** What only the system may ask of a stock change. */
export interface AdjustOptions {
  /**
   * A sale may take the main warehouse below zero by as much as the other
   * warehouses hold and haven't already promised — a pre-order.
   */
  preorder?: boolean;
}

/** Movements that leave an opening cost standing: the opening itself, setting its cost, and moving units between warehouses. */
const COST_NEUTRAL_TYPES = [MovementType.OPENING, MovementType.COST_SET, MovementType.TRANSFER_IN, MovementType.TRANSFER_OUT];

function entryQty(entries: { warehouse: Types.ObjectId; qty: number }[], warehouse: Types.ObjectId): number {
  return entries.find((e) => e.warehouse.equals(warehouse))?.qty ?? 0;
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
  /** Units in the main warehouse — what can be sold now. Negative: pre-orders owed. */
  stock: number;
  /** Units in every warehouse together. */
  totalStock: number;
  /** Units per warehouse, every warehouse that has an entry. */
  stocks: { warehouseId: string; qty: number }[];
  /** Units that can still be pre-ordered from the other warehouses. */
  preorderStock: number;
  lowStockThreshold: number;
  status: 'out' | 'low' | 'in_stock' | 'untracked';
  price?: number;
  /** Whether the stock has a cost yet. */
  valued: boolean;
  /** Cost of the stock on hand (minor units); null until it has one. */
  valueMinor: number | null;
  /** Average cost of one unit; null until the stock has a cost. */
  unitCostMinor: number | null;
  /** Has a cost, and nothing but the opening has touched it — so the opening cost can still be corrected. */
  costCorrectable: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovement>,
    @InjectModel(StockTransfer.name) private transferModel: Model<StockTransfer>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
    private readonly warehouses: WarehousesService,
    // Where cost changes are reported for the platform to follow. Optional so a service built by hand (tests, scripts) still works.
    @Optional() @Inject(STORE_HOST) private readonly storeHost?: string,
    @Optional() private readonly priceLog?: PriceChangeRecorder,
  ) {}

  /**
   * Tells the platform a unit's cost changed — once the transaction that
   * changed it has committed, so a rolled-back purchase leaves no trace.
   * Costs are kept in minor units; the log reads in the currency's own.
   */
  private logCostChange(
    session: ClientSession | undefined,
    product: Product,
    variant: ProductVariant | undefined,
    oldMinor: number | null,
    newMinor: number | null,
    source: PriceSource,
    userId?: string,
  ) {
    if (!this.priceLog || oldMinor === newMinor) return;
    const major = (minor: number | null) => (minor === null ? null : minor / 10 ** DEFAULT_MINOR_UNIT);
    const draft = {
      productId: String(product._id),
      productName: product.name?.en || product.name?.ar || 'Product',
      ...((variant?.sku ?? product.sku) ? { sku: variant?.sku ?? product.sku } : {}),
      ...(variant ? { variantLabel: variant.label } : {}),
      kind: 'cost' as const,
      oldValue: major(oldMinor),
      newValue: major(newMinor),
      source,
    };
    afterCommit(session, () => this.priceLog?.record(this.storeHost, userId, [draft]));
  }

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
    options: AdjustOptions = {},
  ): Promise<StockMovement> {
    if (!session) return withTransaction(this.connection, (s) => this.adjust(dto, userId, s, valueMinor, options));
    const delta = this.signedQuantity(dto.type, dto.quantity);
    if (dto.type === MovementType.TRANSFER_IN || dto.type === MovementType.TRANSFER_OUT) {
      throw new BadRequestException('Move stock between warehouses with a transfer');
    }

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

    const main = await this.warehouses.main();
    const warehouse = await this.warehouses.resolve(dto.warehouseId, session);
    const isMain = (warehouse._id as Types.ObjectId).equals(main._id as Types.ObjectId);
    const entries = await this.prepareEntries(product, variant, [warehouse._id as Types.ObjectId], session);
    const here = entryQty(entries, warehouse._id as Types.ObjectId);
    const total = entries.reduce((t, e) => t + e.qty, 0);
    const label = variant ? `"${variant.label}"` : 'this product';

    // Only the main warehouse may stand below zero — by a backorder, or by a
    // pre-order covered by what the other warehouses hold and haven't promised.
    let preorderQuantity = 0;
    if (delta < 0) {
      const need = -delta;
      const backorder = isMain && product.allowBackorder;
      if (!backorder && here < need) {
        if (isMain && options.preorder && total >= need) {
          preorderQuantity = need - Math.max(here, 0);
        } else {
          throw new BadRequestException(`Not enough stock for ${label} in ${this.warehouseName(warehouse)}: ${here} available, ${need} requested.`);
        }
      }
      if (!backorder && !isMain && total - need < 0) {
        throw new BadRequestException(`These units of ${label} are promised to pre-orders; transfer them to the main warehouse instead.`);
      }
    }

    const pool = { ...this.poolOf(product, variant), qty: total };
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

    await this.applyDelta(product, variant, [{ warehouse: warehouse._id as Types.ObjectId, delta, isMain }], moved.next, session);

    // A receipt or an opening stock with a cost moves the average; what the
    // platform follows is what a unit costs now against what it did.
    if (delta > 0 && valueMinor !== undefined && (dto.type === MovementType.PURCHASE || dto.type === MovementType.OPENING)) {
      this.logCostChange(
        session,
        product,
        variant,
        unitCost(pool),
        unitCost(moved.next),
        dto.type === MovementType.PURCHASE ? 'purchase' : 'opening_stock',
        userId,
      );
    }

    const [movement] = await this.movementModel.create(
      [
        {
          product: new Types.ObjectId(dto.productId),
          variantId: dto.variantId ? new Types.ObjectId(dto.variantId) : undefined,
          variantLabel: variant?.label,
          warehouse: warehouse._id,
          type: dto.type,
          quantity: delta,
          balanceAfter: here + delta,
          preorderQuantity: preorderQuantity || undefined,
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
    if (dto.type === MovementType.OPENING) await this.postOpening(movement, session, userId);
    return movement;
  }

  /**
   * Opening stock that came in with a cost: owned before the books began, so
   * it is booked against owner equity, the same as a cost set afterwards.
   */
  private async postOpening(movement: StockMovement, session: ClientSession, userId?: string) {
    const value = movement.valueMinor ?? 0;
    if (!value) return;
    await this.journal.post(
      {
        date: new Date(),
        source: { type: 'stock_movement', id: movement._id as Types.ObjectId, event: 'opening_cost' },
        lines: [signedLine(ACCOUNT.INVENTORY, value), signedLine(ACCOUNT.EQUITY, -value)],
        memo: memo('opening_stock', { qty: movement.quantity }),
        createdBy: userId,
      },
      session,
    );
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
          memo: memo('opening_stock', { qty: pool.qty }),
          createdBy: userId,
        },
        session,
      );
      this.logCostChange(session, product, variant, null, unitCostMinor, 'opening_cost', userId);
      return movement;
    });
  }

  /**
   * Fixes an opening cost typed wrong. Allowed only while nothing but the
   * opening itself has touched this stock — once units were sold, bought or
   * adjusted, those movements were valued at the old cost and changing it
   * would leave them wrong. The difference is booked against owner equity,
   * where the opening value went, and the history keeps both figures.
   */
  async correctOpeningCost(
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
      if (!variantId && product.variants?.length) throw new BadRequestException('This product has variants — correct the cost of each');

      const pool = this.poolOf(product, variant);
      if (!isValued(pool)) throw new BadRequestException('This stock has no cost yet — set it rather than correct it');

      const later = await this.movementModel
        .exists({
          product: product._id,
          variantId: variant?._id ?? null,
          type: { $nin: COST_NEUTRAL_TYPES },
        })
        .session(session)
        .exec();
      if (later) {
        throw new ConflictException(
          'This stock has been sold, bought or adjusted since its opening cost was set, so that cost can no longer be corrected',
        );
      }

      const oldUnitMinor = unitCost(pool) ?? 0;
      const valueMinor = Math.max(pool.qty, 0) * unitCostMinor;
      const deltaMinor = valueMinor - (pool.valueMinor ?? 0);
      if (deltaMinor === 0 && oldUnitMinor === unitCostMinor) throw new BadRequestException('That is already the cost of this stock');

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
            valueMinor: deltaMinor,
            valueAfterMinor: valueMinor,
            reason: `Opening cost corrected from ${formatMinor(oldUnitMinor)} to ${formatMinor(unitCostMinor)} per unit`,
            user: userId ? new Types.ObjectId(userId) : undefined,
          },
        ],
        { session },
      );
      await this.journal.post(
        {
          date: new Date(),
          source: { type: 'stock_movement', id: movement._id as Types.ObjectId, event: 'opening_cost_corrected' },
          lines: [signedLine(ACCOUNT.INVENTORY, deltaMinor), signedLine(ACCOUNT.EQUITY, -deltaMinor)],
          memo: memo('opening_cost_corrected', { qty: pool.qty }),
          createdBy: userId,
        },
        session,
      );
      this.logCostChange(session, product, variant, oldUnitMinor, unitCostMinor, 'opening_cost_corrected', userId);
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
        memo: memo('stock_movement', movement.reason ? { type: movement.type, reason: movement.reason } : { type: movement.type }),
        createdBy: userId,
      },
      session,
    );
  }

  /** Value of one product's or variant's stock; its units are those of every warehouse. */
  private poolOf(product: Product, variant?: ProductVariant): Pool {
    const source = variant ?? product;
    return {
      qty: totalUnits(source),
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
  async adjustMany(
    items: AdjustStockDto[],
    userId?: string,
    session?: ClientSession,
    options: AdjustOptions = {},
  ): Promise<StockMovement[]> {
    const run = async (s: ClientSession) => {
      const applied: StockMovement[] = [];
      for (const item of items) applied.push(await this.adjust(item, userId, s, undefined, options));
      return applied;
    };
    return session ? run(session) : withTransaction(this.connection, run);
  }

  /** Whether the ledger holds any movement for a product — its stock history. */
  async hasMovements(productId: string | Types.ObjectId): Promise<boolean> {
    return !!(await this.movementModel.exists({ product: new Types.ObjectId(productId) }).exec());
  }

  /** Reconciles recorded stock in one warehouse (the main one by default) against a physical count. */
  async stockTake(dto: StockTakeDto, userId?: string): Promise<StockMovement | null> {
    const current = await this.currentStock(dto.productId, dto.variantId, dto.warehouseId);
    const delta = dto.countedQuantity - current;

    if (delta === 0) return null;

    // The count itself says which way the correction goes, so the caller never
    // has to pick a type or work out a sign.
    return this.adjust(
      {
        productId: dto.productId,
        variantId: dto.variantId,
        warehouseId: dto.warehouseId,
        type: delta > 0 ? MovementType.ADJUSTMENT_IN : MovementType.ADJUSTMENT_OUT,
        quantity: Math.abs(delta),
        reason: dto.reason ?? `Stock take: counted ${dto.countedQuantity}, recorded ${current}`,
      },
      userId,
    );
  }

  // ── Transfers ───────────────────────────────────────────────────────────────

  /**
   * Moves units from one warehouse to another, all lines or none, in one
   * step. Only quantities move — the stock stays the store's, so its value
   * and the books are untouched; what the move cost is an expense. Units the
   * main warehouse owes to pre-orders are not there to send.
   */
  async transfer(dto: CreateTransferDto, userId?: string): Promise<StockTransfer> {
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException('Pick two different warehouses');
    return withTransaction(this.connection, async (session) => {
      const main = await this.warehouses.main();
      const from = await this.warehouses.resolve(dto.fromWarehouseId, session);
      const to = await this.warehouses.resolve(dto.toWarehouseId, session);
      const fromId = from._id as Types.ObjectId;
      const toId = to._id as Types.ObjectId;
      const transferId = new Types.ObjectId();
      const counter = await this.counterModel
        .findOneAndUpdate({ name: 'stockTransfer' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        .exec();
      const transferNumber = 1000 + counter!.seq;
      const reference = `Transfer #${transferNumber}`;

      const lines: StockTransfer['lines'] = [];
      for (const [i, line] of dto.lines.entries()) {
        const product = await this.productModel.findById(line.productId).session(session).exec();
        if (!product) throw new NotFoundException(`Line ${i + 1}: product not found`);
        const name = product.name.en ?? product.name.ar;
        if (!product.trackStock) throw new BadRequestException(`Line ${i + 1}: ${name} doesn't track stock`);
        const hasVariants = (product.variants?.length ?? 0) > 0;
        const variant = line.variantId ? product.variants.find((v) => v._id.toString() === line.variantId) : undefined;
        if (hasVariants ? !variant : !!line.variantId) {
          throw new BadRequestException(`Line ${i + 1}: ${hasVariants ? 'pick which variant to move' : 'this product has no variants'}`);
        }

        const entries = await this.prepareEntries(product, variant, [fromId, toId], session);
        const available = entryQty(entries, fromId);
        if (available < line.quantity) {
          throw new BadRequestException(
            `Line ${i + 1}: only ${Math.max(available, 0)} of ${name}${variant ? ` (${variant.label})` : ''} in ${this.warehouseName(from)}`,
          );
        }

        await this.applyDelta(
          product,
          variant,
          [
            { warehouse: fromId, delta: -line.quantity, isMain: fromId.equals(main._id as Types.ObjectId) },
            { warehouse: toId, delta: line.quantity, isMain: toId.equals(main._id as Types.ObjectId) },
          ],
          null,
          session,
        );

        const pool = this.poolOf(product, variant);
        const base = {
          product: product._id,
          variantId: variant?._id,
          variantLabel: variant?.label,
          transfer: transferId,
          reference,
          reason: dto.note,
          valueAfterMinor: pool.valueMinor ?? undefined,
          user: userId ? new Types.ObjectId(userId) : undefined,
        };
        await this.movementModel.create(
          [
            { ...base, warehouse: fromId, type: MovementType.TRANSFER_OUT, quantity: -line.quantity, balanceAfter: available - line.quantity },
            {
              ...base,
              warehouse: toId,
              type: MovementType.TRANSFER_IN,
              quantity: line.quantity,
              balanceAfter: entryQty(entries, toId) + line.quantity,
            },
          ],
          { session, ordered: true },
        );
        lines.push({
          product: product._id as Types.ObjectId,
          variantId: variant?._id,
          name: product.name,
          variantLabel: variant?.label,
          sku: variant?.sku ?? product.sku,
          quantity: line.quantity,
        });
      }

      const [transfer] = await this.transferModel.create(
        [
          {
            _id: transferId,
            transferNumber,
            from: fromId,
            to: toId,
            lines,
            totalUnits: lines.reduce((t, l) => t + l.quantity, 0),
            note: dto.note,
            createdBy: userId ? new Types.ObjectId(userId) : undefined,
          },
        ],
        { session },
      );
      return transfer;
    });
  }

  async getTransfers(query: QueryTransfersDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const filter: QueryFilter<StockTransfer> = {};
    if (query.warehouseId) {
      const id = new Types.ObjectId(query.warehouseId);
      filter.$or = [{ from: id }, { to: id }];
    }
    const [data, total] = await Promise.all([
      this.transferModel
        .find(filter)
        .populate('from', 'name code')
        .populate('to', 'name code')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.transferModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  // ── Warehouse entries ───────────────────────────────────────────────────────

  /**
   * The warehouse entries of one product or variant, with an entry for each
   * of `needed` — written now if any was missing, so the `$inc` that follows
   * has an element to land on. Stock from before warehouses (no entries) is
   * the main warehouse's.
   */
  private async prepareEntries(
    product: Product,
    variant: ProductVariant | undefined,
    needed: Types.ObjectId[],
    session: ClientSession,
  ): Promise<{ warehouse: Types.ObjectId; qty: number }[]> {
    const source = variant ?? product;
    const main = (await this.warehouses.main())._id as Types.ObjectId;
    let changed = false;
    const entries: { warehouse: Types.ObjectId; qty: number }[] = (source.stocks ?? []).map((e: WarehouseStock) => ({
      warehouse: e.warehouse,
      qty: e.qty ?? 0,
    }));
    if (!entries.length) {
      entries.push({ warehouse: main, qty: source.stock ?? 0 });
      changed = true;
    }
    for (const id of needed) {
      if (!entries.some((e) => e.warehouse.equals(id))) {
        entries.push({ warehouse: id, qty: 0 });
        changed = true;
      }
    }
    if (changed) {
      if (variant) {
        await this.productModel
          .updateOne({ _id: product._id }, { $set: { 'variants.$[v].stocks': entries } }, { session, arrayFilters: [{ 'v._id': variant._id }] })
          .exec();
      } else {
        await this.productModel.updateOne({ _id: product._id }, { $set: { stocks: entries } }, { session }).exec();
      }
    }
    return entries;
  }

  /**
   * Moves units in one or more warehouses of one product or variant, keeping
   * `stock` equal to the main warehouse's entry, and writes the stock's new
   * value beside it (`next`; null leaves the value alone). The checks were
   * made on what this transaction read; a concurrent change to the same
   * product makes one of the two transactions retry.
   */
  private async applyDelta(
    product: Product,
    variant: ProductVariant | undefined,
    moves: { warehouse: Types.ObjectId; delta: number; isMain: boolean }[],
    next: Pool | null,
    session: ClientSession,
  ): Promise<void> {
    const prefix = variant ? 'variants.$[v].' : '';
    const inc: Record<string, number> = {};
    const arrayFilters: Record<string, unknown>[] = variant ? [{ 'v._id': variant._id }] : [];
    moves.forEach((move, i) => {
      inc[`${prefix}stocks.$[w${i}].qty`] = move.delta;
      arrayFilters.push({ [`w${i}.warehouse`]: move.warehouse });
      if (move.isMain) inc[`${prefix}stock`] = (inc[`${prefix}stock`] ?? 0) + move.delta;
    });
    if (inc[`${prefix}stock`] === 0) delete inc[`${prefix}stock`];

    const update: Record<string, unknown> = { $inc: inc };
    if (next && next.valueMinor !== null) update.$set = this.valueFields(prefix, next);
    await this.productModel.updateOne({ _id: product._id }, update, { session, arrayFilters }).exec();
  }

  private warehouseName(warehouse: Warehouse): string {
    return warehouse.name.en ?? warehouse.name.ar ?? warehouse.code;
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

  /** The warehouse a caller names, checked to exist and be open; the main one when it names none. */
  resolveWarehouse(id?: string, session?: ClientSession): Promise<Warehouse> {
    return this.warehouses.resolve(id, session);
  }

  /** Stock of one product or variant right now, in one warehouse (the main one by default). */
  async currentStock(productId: string, variantId?: string, warehouseId?: string, session?: ClientSession): Promise<number> {
    const product = await this.productModel.findById(productId).session(session ?? null).exec();
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    let source: Product | ProductVariant = product;
    if (variantId) {
      const variant = product.variants.find((v) => v._id.toString() === variantId);
      if (!variant) throw new NotFoundException(`Variant ${variantId} not found on this product`);
      source = variant;
    }
    if (!warehouseId) return source.stock ?? 0;
    const main = await this.warehouses.main();
    const id = new Types.ObjectId(warehouseId);
    if (!source.stocks?.length) return id.equals(main._id as Types.ObjectId) ? (source.stock ?? 0) : 0;
    return source.stocks.find((e) => e.warehouse.equals(id))?.qty ?? 0;
  }

  /**
   * Whether a basket can be fulfilled from the main warehouse — or, with
   * `preorder`, from it and what the others hold. Lets a caller list what is
   * short before any stock moves.
   */
  async checkAvailability(
    items: { productId: string; variantId?: string; quantity: number }[],
    preorder = false,
  ): Promise<{ available: boolean; shortages: { productId: string; variantId?: string; requested: number; available: number }[] }> {
    const shortages: { productId: string; variantId?: string; requested: number; available: number }[] = [];

    for (const item of items) {
      const product = await this.productModel.findById(item.productId).exec();
      if (!product) {
        shortages.push({ ...item, requested: item.quantity, available: 0 });
        continue;
      }
      if (!product.trackStock || product.allowBackorder) continue;

      const source = item.variantId ? product.variants.find((v) => v._id.toString() === item.variantId) : product;
      const now = Math.max(source?.stock ?? 0, 0);
      const available = now + (preorder && source ? preorderUnits(source) : 0);

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

    const touched = await this.touchedSinceOpening(products.map((p) => p._id as Types.ObjectId));
    const main = String((await this.warehouses.main())._id);
    let rows = products.flatMap((product) =>
      product.variants?.length
        ? product.variants.map((variant) => this.toLevel(product, variant, touched, main))
        : [this.toLevel(product, undefined, touched, main)],
    );
    if (query.warehouseId) rows = rows.filter((row) => row.stocks.some((e) => e.warehouseId === query.warehouseId && e.qty !== 0));

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
      totalUnits: tracked.reduce((sum, row) => sum + row.totalStock, 0),
      // At selling prices — what the stock would fetch, not what it cost.
      stockValue: tracked.reduce((sum, row) => sum + Math.max(row.totalStock, 0) * (row.price ?? 0), 0),
      // At cost — what the books carry as inventory. Uncosted stock isn't in it.
      costValueMinor: tracked.reduce((sum, row) => sum + (row.valueMinor ?? 0), 0),
      uncostedItems: tracked.filter((row) => !row.valued && row.totalStock > 0).length,
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
      totalUnits: rows.reduce((t, r) => t + r.totalStock, 0),
      uncosted: rows.filter((r) => !r.valued && r.totalStock > 0).map((r) => ({ productId: r.productId, variantId: r.variantId, name: r.name, variantLabel: r.variantLabel, stock: r.totalStock })),
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
    if (query.warehouseId) {
      const id = new Types.ObjectId(query.warehouseId);
      const main = await this.warehouses.main();
      // Rows from before warehouses name none; they were the main warehouse's.
      filter.$or = (main._id as Types.ObjectId).equals(id) ? [{ warehouse: id }, { warehouse: { $exists: false } }] : [{ warehouse: id }];
    }
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
        .populate('user', 'name email')
        .populate('warehouse', 'name code')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.movementModel.countDocuments(filter).exec(),
    ]);

    return { data: (await this.withProducts(data)) as unknown as StockMovement[], total, page, limit };
  }

  /**
   * Attaches each movement's product — the live one, or the copy kept when it
   * was deleted (flagged `deleted: true`) so its history still has a name.
   */
  private async withProducts(movements: StockMovement[]) {
    const ids = [...new Set(movements.map((m) => String(m.product)))].map((id) => new Types.ObjectId(id));
    const pick = 'name slug images sku';
    const live = await this.productModel.find({ _id: { $in: ids } }).select(pick).lean().exec();
    const byId = new Map<string, Record<string, unknown>>(live.map((p) => [String(p._id), p as unknown as Record<string, unknown>]));
    const missing = ids.filter((id) => !byId.has(String(id)));
    if (missing.length) {
      const gone = await this.connection
        .model('DeletedProduct')
        .find({ _id: { $in: missing } })
        .lean<{ _id: Types.ObjectId; snapshot: Record<string, unknown> }[]>()
        .exec();
      for (const d of gone) {
        const { name, slug, images, sku } = d.snapshot ?? {};
        byId.set(String(d._id), { _id: d._id, name, slug, images, sku, deleted: true });
      }
    }
    return movements.map((m) => ({ ...m.toObject(), product: byId.get(String(m.product)) ?? null }));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Items (`product:variant`) with any movement besides their opening — their opening cost is settled. */
  private async touchedSinceOpening(productIds: Types.ObjectId[]): Promise<Set<string>> {
    if (!productIds.length) return new Set();
    const groups = await this.movementModel
      .aggregate<{ _id: { product: Types.ObjectId; variantId?: Types.ObjectId } }>([
        { $match: { product: { $in: productIds }, type: { $nin: COST_NEUTRAL_TYPES } } },
        { $group: { _id: { product: '$product', variantId: '$variantId' } } },
      ])
      .exec();
    return new Set(groups.map((g) => `${g._id.product.toString()}:${g._id.variantId?.toString() ?? ''}`));
  }

  private toLevel(product: Product, variant: ProductVariant | undefined, touched: Set<string>, mainId: string): StockLevel {
    const source = variant ?? product;
    const stock = source.stock ?? 0;
    const stocks = source.stocks?.length
      ? source.stocks.map((e) => ({ warehouseId: String(e.warehouse), qty: e.qty ?? 0 }))
      : [{ warehouseId: mainId, qty: stock }];
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
      totalStock: totalUnits(source),
      stocks,
      preorderStock: preorderUnits(source),
      lowStockThreshold: threshold,
      status,
      price: variant?.price ?? product.price,
      valued: isValued(pool),
      valueMinor: pool.valueMinor,
      unitCostMinor: unitCost(pool),
      costCorrectable:
        product.trackStock && isValued(pool) && !touched.has(`${product._id!.toString()}:${variant?._id?.toString() ?? ''}`),
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
