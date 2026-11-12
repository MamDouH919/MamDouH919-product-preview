import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { MAX_WAREHOUSES, TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { Product } from '../products/schemas/product.schema';
import { Warehouse } from './schemas/warehouse.schema';
import { StockMovement } from './schemas/stock-movement.schema';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

/** What the warehouse list shows: the warehouse and the units it holds. */
export interface WarehouseView {
  _id: string;
  name: Warehouse['name'];
  code: string;
  address?: string;
  notes?: string;
  isMain: boolean;
  isActive: boolean;
  /** Units held, all products and variants together. Negative only on the main one (pre-orders owed). */
  units: number;
  /** Products or variants with any units here. */
  items: number;
  createdAt?: Date;
}

const DEFAULT_MAIN = {
  name: { ar: 'المخزن الرئيسي', en: 'Main warehouse' },
  code: 'MAIN',
  isMain: true,
  isActive: true,
};

@Injectable()
export class WarehousesService {
  private mainPromise?: Promise<Warehouse>;

  constructor(
    @InjectModel(Warehouse.name) private warehouseModel: Model<Warehouse>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovement>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    @Inject(MAX_WAREHOUSES) private maxWarehouses: number,
  ) {}

  /**
   * The warehouse sales take stock from. Every store has one: a store that
   * predates warehouses gets it the first time anyone asks, holding all the
   * stock it already had. Created outside any transaction, so a checkout that
   * retries never races itself over it.
   */
  main(): Promise<Warehouse> {
    this.mainPromise ??= this.ensureMain().catch((error) => {
      this.mainPromise = undefined;
      throw error;
    });
    return this.mainPromise;
  }

  private async ensureMain(): Promise<Warehouse> {
    const existing = await this.warehouseModel.findOne({ isMain: true }).exec();
    if (existing) return existing;
    try {
      // A store that already has a warehouse coded MAIN gets another code.
      const taken = await this.warehouseModel.exists({ code: DEFAULT_MAIN.code }).exec();
      return await this.warehouseModel.create({ ...DEFAULT_MAIN, code: taken ? `MAIN-${Date.now().toString(36).toUpperCase()}` : DEFAULT_MAIN.code });
    } catch (error: any) {
      // Two requests created it at once; the unique index let one through.
      if (error?.code === 11000) {
        const winner = await this.warehouseModel.findOne({ isMain: true }).exec();
        if (winner) return winner;
      }
      throw error;
    }
  }

  async find(id: string, session?: ClientSession): Promise<Warehouse> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Warehouse not found');
    const warehouse = await this.warehouseModel.findById(id).session(session ?? null).exec();
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  /** The warehouse a stock change names, or the main one when it names none. Refuses a closed one. */
  async resolve(id: string | undefined, session?: ClientSession): Promise<Warehouse> {
    const warehouse = id ? await this.find(id, session) : await this.main();
    if (!warehouse.isActive) throw new BadRequestException(`${warehouse.name.en ?? warehouse.name.ar} is closed`);
    return warehouse;
  }

  async list(): Promise<{ data: WarehouseView[]; max: number }> {
    await this.main();
    const [warehouses, totals] = await Promise.all([
      this.warehouseModel.find().sort({ isMain: -1, createdAt: 1 }).lean().exec(),
      this.unitsByWarehouse(),
    ]);
    return {
      max: this.maxWarehouses,
      data: warehouses.map((w) => {
        const t = totals.get(String(w._id));
        return {
          _id: String(w._id),
          name: w.name,
          code: w.code,
          address: w.address,
          notes: w.notes,
          isMain: w.isMain,
          isActive: w.isActive,
          units: t?.units ?? 0,
          items: t?.items ?? 0,
          createdAt: (w as { createdAt?: Date }).createdAt,
        };
      }),
    };
  }

  /** Active warehouses, main first — for pickers. */
  async active(): Promise<Warehouse[]> {
    await this.main();
    return this.warehouseModel.find({ isActive: true }).sort({ isMain: -1, createdAt: 1 }).exec();
  }

  async create(dto: CreateWarehouseDto): Promise<Warehouse> {
    await this.main();
    await this.assertRoomForAnother();
    await this.assertCodeFree(dto.code);
    return this.warehouseModel.create({
      name: dto.name,
      code: dto.code,
      address: dto.address,
      notes: dto.notes,
      isMain: false,
      isActive: true,
    });
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.find(id);
    if (dto.code !== undefined && dto.code.toUpperCase() !== warehouse.code) await this.assertCodeFree(dto.code, warehouse._id as Types.ObjectId);

    if (dto.isActive === false && warehouse.isActive) {
      if (warehouse.isMain) throw new BadRequestException('The main warehouse cannot be closed; make another one main first');
      if (await this.holdsStock(warehouse._id as Types.ObjectId)) {
        throw new ConflictException('This warehouse still holds stock; transfer it out before closing it');
      }
    }
    if (dto.isActive === true && !warehouse.isActive) await this.assertRoomForAnother();

    const set: Record<string, unknown> = {};
    for (const key of ['name', 'code', 'address', 'notes', 'isActive'] as const) {
      if (dto[key] !== undefined) set[key] = dto[key];
    }
    const updated = await this.warehouseModel.findByIdAndUpdate(warehouse._id, { $set: set }, { returnDocument: 'after', runValidators: true }).exec();
    return updated!;
  }

  /** Deletes a warehouse nothing ever moved through; one with history can only be closed. */
  async remove(id: string): Promise<void> {
    const warehouse = await this.find(id);
    if (warehouse.isMain) throw new BadRequestException('The main warehouse cannot be deleted');
    const used = await this.movementModel.exists({ warehouse: warehouse._id }).exec();
    if (used) throw new ConflictException('Stock has moved through this warehouse, so it cannot be deleted. Close it instead.');
    // Never moved stock, so any entries are empty ones; drop them with it.
    await this.productModel.updateMany({ 'stocks.warehouse': warehouse._id }, { $pull: { stocks: { warehouse: warehouse._id } } }).exec();
    await this.productModel
      .updateMany({ 'variants.stocks.warehouse': warehouse._id }, { $pull: { 'variants.$[].stocks': { warehouse: warehouse._id } } })
      .exec();
    await this.warehouseModel.deleteOne({ _id: warehouse._id }).exec();
  }

  /**
   * Makes another warehouse the one sales take stock from. Each product's
   * sellable `stock` is re-read from the new main warehouse's entry. Refused
   * while the current main owes pre-ordered units — only the main warehouse
   * may stand below zero, and those units are promised from it.
   */
  async setMain(id: string): Promise<Warehouse> {
    const target = await this.find(id);
    if (target.isMain) return target;
    if (!target.isActive) throw new BadRequestException('Open this warehouse before making it the main one');
    const current = await this.main();
    const currentId = current._id as Types.ObjectId;
    const targetId = target._id as Types.ObjectId;

    const owing = await this.productModel
      .exists({
        $or: [
          { stocks: { $elemMatch: { warehouse: currentId, qty: { $lt: 0 } } } },
          { 'variants.stocks': { $elemMatch: { warehouse: currentId, qty: { $lt: 0 } } } },
          { 'stocks.0': { $exists: false }, stock: { $lt: 0 } },
          { variants: { $elemMatch: { 'stocks.0': { $exists: false }, stock: { $lt: 0 } } } },
        ],
      })
      .exec();
    if (owing) {
      throw new ConflictException(
        `${current.name.en ?? current.name.ar} owes pre-ordered units. Transfer stock in to cover them before changing the main warehouse.`,
      );
    }

    await withTransaction(this.connection, async (session) => {
      await this.warehouseModel.updateOne({ _id: currentId }, { $set: { isMain: false } }, { session }).exec();
      await this.warehouseModel.updateOne({ _id: targetId }, { $set: { isMain: true } }, { session }).exec();
      await this.productModel.updateMany({}, rebaseMainPipeline(currentId, targetId), { session, updatePipeline: true }).exec();
    });
    this.mainPromise = undefined;
    return (await this.find(id))!;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async assertRoomForAnother() {
    const open = await this.warehouseModel.countDocuments({ isActive: true }).exec();
    if (open >= this.maxWarehouses) {
      throw new ForbiddenException(
        `Your plan allows ${this.maxWarehouses} warehouse${this.maxWarehouses === 1 ? '' : 's'}. Contact us to add more.`,
      );
    }
  }

  private async assertCodeFree(code: string, except?: Types.ObjectId) {
    const clash = await this.warehouseModel
      .exists({ code: code.trim().toUpperCase(), ...(except ? { _id: { $ne: except } } : {}) })
      .exec();
    if (clash) throw new ConflictException(`Another warehouse already uses the code ${code.toUpperCase()}`);
  }

  private async holdsStock(warehouse: Types.ObjectId): Promise<boolean> {
    return !!(await this.productModel
      .exists({
        $or: [
          { stocks: { $elemMatch: { warehouse, qty: { $ne: 0 } } } },
          { 'variants.stocks': { $elemMatch: { warehouse, qty: { $ne: 0 } } } },
        ],
      })
      .exec());
  }

  /** Units and items per warehouse, products and variants together. */
  private async unitsByWarehouse(): Promise<Map<string, { units: number; items: number }>> {
    const main = await this.main();
    const rows = await this.productModel
      .aggregate<{ _id: Types.ObjectId; units: number; items: number }>([
        { $match: { trackStock: true } },
        {
          $project: {
            entries: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
                { $map: { input: '$variants', as: 'v', in: legacyEntries('$$v', main._id as Types.ObjectId) } },
                [legacyEntries('$$ROOT', main._id as Types.ObjectId)],
              ],
            },
          },
        },
        { $unwind: '$entries' },
        { $unwind: '$entries' },
        { $group: { _id: '$entries.warehouse', units: { $sum: '$entries.qty' }, items: { $sum: { $cond: [{ $ne: ['$entries.qty', 0] }, 1, 0] } } } },
      ])
      .exec();
    return new Map(rows.map((r) => [String(r._id), { units: r.units, items: r.items }]));
  }
}

/** A source's warehouse entries, or — before it had any — its `stock` as the main warehouse's. */
function legacyEntries(source: string, main: Types.ObjectId) {
  const stocks = source === '$$ROOT' ? '$stocks' : `${source}.stocks`;
  const stock = source === '$$ROOT' ? '$stock' : `${source}.stock`;
  return {
    $cond: [
      { $gt: [{ $size: { $ifNull: [stocks, []] } }, 0] },
      stocks,
      [{ warehouse: main, qty: { $ifNull: [stock, 0] } }],
    ],
  };
}

/**
 * The update that moves every product's sellable `stock` onto a new main
 * warehouse: first give entry-less stock (from before warehouses) to the old
 * main, then read `stock` off the new main's entry.
 */
function rebaseMainPipeline(oldMain: Types.ObjectId, newMain: Types.ObjectId) {
  const normalized = (stocks: string, stock: string) => ({
    $cond: [
      { $gt: [{ $size: { $ifNull: [stocks, []] } }, 0] },
      stocks,
      { $cond: [{ $ne: [{ $ifNull: [stock, 0] }, 0] }, [{ warehouse: oldMain, qty: stock }], []] },
    ],
  });
  const mainQty = (stocks: string) => ({
    $sum: { $map: { input: { $filter: { input: stocks, as: 's', cond: { $eq: ['$$s.warehouse', newMain] } } }, as: 's', in: '$$s.qty' } },
  });
  return [
    {
      $set: {
        stocks: normalized('$stocks', '$stock'),
        variants: {
          $map: {
            input: { $ifNull: ['$variants', []] },
            as: 'v',
            in: { $mergeObjects: ['$$v', { stocks: normalized('$$v.stocks', '$$v.stock') }] },
          },
        },
      },
    },
    {
      $set: {
        stock: mainQty('$stocks'),
        variants: {
          $map: { input: '$variants', as: 'v', in: { $mergeObjects: ['$$v', { stock: mainQty('$$v.stocks') }] } },
        },
      },
    },
  ];
}
