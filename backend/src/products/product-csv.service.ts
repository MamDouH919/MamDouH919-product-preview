import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { Category } from '../categories/schemas/category.schema';
import { SubCategory } from '../sub-categories/schemas/sub-category.schema';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { InventoryService } from '../inventory/inventory.service';
import { parseCsv, toCsv, unguard } from '../common/helpers/csv';

/**
 * The spreadsheet layout. One row per product, or one per variant — product
 * columns then repeat on each of its rows, and the first row is the one read.
 * Description (rich text) and images aren't in it: they don't survive a
 * spreadsheet and are edited in the dashboard.
 */
export const PRODUCT_CSV_COLUMNS = [
  'product_id',
  'slug',
  'name_en',
  'name_ar',
  'short_description_en',
  'short_description_ar',
  'category',
  'sub_category',
  'tags',
  'price',
  'sku',
  'is_active',
  'track_stock',
  'low_stock_threshold',
  'allow_backorder',
  'variant_id',
  'variant_label',
  'variant_price',
  'variant_sku',
  'stock',
] as const;
type Column = (typeof PRODUCT_CSV_COLUMNS)[number];
type Row = { line: number; cells: Partial<Record<Column, string>> };

const MAX_ROWS = 2000;
const VARIANT_COLUMNS: Column[] = ['variant_id', 'variant_label', 'variant_price', 'variant_sku'];

export interface ImportRowReport {
  /** Spreadsheet line of the product's first row (the header is line 1). */
  line: number;
  product: string;
  action: 'create' | 'update' | 'unchanged' | 'error';
  changes: string[];
  errors: string[];
}

export interface ImportReport {
  applied: boolean;
  summary: { create: number; update: number; unchanged: number; error: number };
  rows: ImportRowReport[];
}

/** A product's planned writes, worked out before anything is touched. */
interface Plan {
  report: ImportRowReport;
  existing?: Product;
  create?: CreateProductDto;
  set: Record<string, unknown>;
  variantSets: { variantId: string; set: Record<string, unknown> }[];
  newVariants: { label: string; price?: number; sku?: string }[];
  /** Counted stock per target; `variantLabel` points at a variant created by this import. */
  stock: { variantId?: string; variantLabel?: string; counted: number }[];
}

/** Western digits for Arabic-Indic ones, so "١٢٠" reads as 120. */
const westernDigits = (text: string) =>
  text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const sameId = (a: unknown, b: unknown) => String((a as { _id?: unknown })?._id ?? a ?? '') === String((b as { _id?: unknown })?._id ?? b ?? '');

@Injectable()
export class ProductCsvService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(SubCategory.name) private subCategoryModel: Model<SubCategory>,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  // ── Export ──────────────────────────────────────────────────────────────────

  async exportCsv(): Promise<string> {
    const products = await this.productModel
      .find()
      .sort({ order: 1, createdAt: -1 })
      .populate<{ category: Category }>('category', 'slug')
      .populate<{ subCategory: SubCategory }>('subCategory', 'slug')
      .lean()
      .exec();

    const rows: unknown[][] = [];
    for (const p of products) {
      const base = [
        String(p._id),
        p.slug,
        p.name?.en ?? '',
        p.name?.ar ?? '',
        p.shortDescription?.en ?? '',
        p.shortDescription?.ar ?? '',
        p.category?.slug ?? '',
        p.subCategory?.slug ?? '',
        (p.tags ?? []).join('|'),
        p.price ?? '',
        p.sku ?? '',
        p.isActive,
        p.trackStock,
        p.lowStockThreshold ?? 0,
        p.allowBackorder,
      ];
      if (p.variants?.length) {
        for (const v of p.variants) {
          rows.push([...base, String(v._id), v.label, v.price ?? '', v.sku ?? '', p.trackStock ? v.stock : '']);
        }
      } else {
        rows.push([...base, '', '', '', '', p.trackStock ? p.stock : '']);
      }
    }
    return toCsv([...PRODUCT_CSV_COLUMNS], rows);
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  /**
   * Checks the whole file first and reports, per product, what would change.
   * With `apply`, and only if nothing failed the check, it then makes those
   * changes. An empty cell always means "leave as it is" — a sheet with only
   * the columns being edited can't wipe the rest.
   */
  async importCsv(text: string, apply: boolean, userId?: string): Promise<ImportReport> {
    const rows = this.readRows(text);
    const plans = await this.plan(rows);

    const summary = { create: 0, update: 0, unchanged: 0, error: 0 };
    for (const p of plans) summary[p.report.action]++;
    const report = (applied: boolean): ImportReport => ({ applied, summary, rows: plans.map((p) => p.report) });

    if (!apply || summary.error > 0) return report(false);

    for (const plan of plans) {
      try {
        await this.execute(plan, userId);
      } catch (error) {
        // Earlier products are already saved — say exactly which one stopped it.
        plan.report.action = 'error';
        plan.report.errors.push((error as Error).message);
        summary.error++;
        return report(true);
      }
    }
    return report(true);
  }

  private readRows(text: string): Row[] {
    const table = parseCsv(text);
    if (!table.length) throw new BadRequestException('The file is empty');

    const header = table[0].map((h) => h.trim().toLowerCase());
    const unknown = header.filter((h) => h && !PRODUCT_CSV_COLUMNS.includes(h as Column));
    if (unknown.length) throw new BadRequestException(`Unknown column(s): ${unknown.join(', ')}`);
    if (!header.some((h) => ['product_id', 'slug', 'name_en', 'name_ar'].includes(h))) {
      throw new BadRequestException('The file needs a product_id, slug or name column');
    }
    if (table.length - 1 > MAX_ROWS) {
      throw new BadRequestException(`At most ${MAX_ROWS} rows per import — split the file`);
    }

    return table.slice(1).map((cells, i) => ({
      line: i + 2,
      cells: Object.fromEntries(
        header.map((h, c) => [h, unguard((cells[c] ?? '').trim())]).filter(([h]) => h),
      ) as Row['cells'],
    }));
  }

  private async plan(rows: Row[]): Promise<Plan[]> {
    // Group rows into products, keeping file order.
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const c = row.cells;
      const key = c.product_id
        ? `id:${c.product_id}`
        : c.slug
          ? `slug:${c.slug.toLowerCase()}`
          : `name:${c.name_en ?? ''}|${c.name_ar ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const ids = [...groups.values()].map((g) => g[0].cells.product_id).filter((id): id is string => !!id && Types.ObjectId.isValid(id));
    const slugs = [...groups.values()].map((g) => g[0].cells.slug?.toLowerCase()).filter((s): s is string => !!s);
    const [products, categories, subCategories] = await Promise.all([
      this.productModel.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }] }).exec(),
      this.categoryModel.find().select('slug name').lean().exec(),
      this.subCategoryModel.find().select('slug name category').lean().exec(),
    ]);
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const bySlug = new Map(products.map((p) => [p.slug.toLowerCase(), p]));

    const findIn = <T extends { slug: string; name?: { en?: string; ar?: string } }>(list: T[], value: string) => {
      const v = value.toLowerCase();
      return list.find((x) => x.slug.toLowerCase() === v || x.name?.en?.toLowerCase() === v || x.name?.ar === value);
    };

    return [...groups.values()].map((group) => this.planProduct(group, byId, bySlug, (v) => findIn(categories, v), (v) => findIn(subCategories, v)));
  }

  private planProduct(
    group: Row[],
    byId: Map<string, Product>,
    bySlug: Map<string, Product>,
    findCategory: (v: string) => { _id: unknown } | undefined,
    findSubCategory: (v: string) => { _id: unknown; category: unknown } | undefined,
  ): Plan {
    const first = group[0].cells;
    const errors: string[] = [];
    const changes: string[] = [];
    const err = (line: number, message: string) => errors.push(`Line ${line}: ${message}`);

    const existing = first.product_id ? byId.get(first.product_id) : first.slug ? bySlug.get(first.slug.toLowerCase()) : undefined;
    if (first.product_id && !existing) err(group[0].line, `no product with id ${first.product_id}`);

    const label = first.name_en || first.name_ar || existing?.name?.en || existing?.name?.ar || first.slug || first.product_id || '?';
    const plan: Plan = {
      report: { line: group[0].line, product: label, action: 'unchanged', changes, errors },
      existing,
      set: {},
      variantSets: [],
      newVariants: [],
      stock: [],
    };

    // Parsers that report into `errors` and return undefined for blank or bad cells.
    const line = group[0].line;
    const num = (value: string | undefined, field: string, ln = line, int = false) => {
      if (!value) return undefined;
      const n = Number(westernDigits(value).replace(/\s/g, ''));
      if (!Number.isFinite(n) || n < 0 || (int && !Number.isInteger(n))) {
        err(ln, `${field} must be a ${int ? 'whole ' : ''}number of 0 or more`);
        return undefined;
      }
      return n;
    };
    const bool = (value: string | undefined, field: string) => {
      if (!value) return undefined;
      const v = value.toLowerCase();
      if (['true', 'yes', '1', 'y', 'نعم'].includes(v)) return true;
      if (['false', 'no', '0', 'n', 'لا'].includes(v)) return false;
      err(line, `${field} must be true or false`);
      return undefined;
    };

    // ── Product-level fields ──
    const wanted: Record<string, unknown> = {};
    if (first.slug && existing && first.slug !== existing.slug && first.product_id) wanted.slug = first.slug.toLowerCase();
    if (first.name_en) wanted['name.en'] = first.name_en;
    if (first.name_ar) wanted['name.ar'] = first.name_ar;
    if (first.short_description_en) wanted['shortDescription.en'] = first.short_description_en;
    if (first.short_description_ar) wanted['shortDescription.ar'] = first.short_description_ar;
    if (first.tags) wanted.tags = first.tags.split(/[|;]/).map((t) => t.trim()).filter(Boolean);
    if (first.sku) wanted.sku = first.sku;
    const price = num(first.price, 'price');
    if (price !== undefined) wanted.price = price;
    const isActive = bool(first.is_active, 'is_active');
    if (isActive !== undefined) wanted.isActive = isActive;
    const trackStock = bool(first.track_stock, 'track_stock');
    if (trackStock !== undefined) wanted.trackStock = trackStock;
    const allowBackorder = bool(first.allow_backorder, 'allow_backorder');
    if (allowBackorder !== undefined) wanted.allowBackorder = allowBackorder;
    const threshold = num(first.low_stock_threshold, 'low_stock_threshold', line, true);
    if (threshold !== undefined) wanted.lowStockThreshold = threshold;

    let categoryId = existing?.category;
    if (first.category) {
      const category = findCategory(first.category);
      if (!category) err(line, `no category "${first.category}"`);
      else {
        wanted.category = category._id;
        categoryId = category._id as Types.ObjectId;
      }
    }
    if (first.sub_category) {
      const sub = findSubCategory(first.sub_category);
      if (!sub) err(line, `no sub-category "${first.sub_category}"`);
      else if (categoryId && !sameId(sub.category, categoryId)) err(line, `sub-category "${first.sub_category}" isn't in that category`);
      else wanted.subCategory = sub._id;
    }

    const tracks = (wanted.trackStock as boolean | undefined) ?? existing?.trackStock ?? true;

    // ── Variant rows and stock ──
    const variantRows = group.filter((r) => VARIANT_COLUMNS.some((c) => r.cells[c]));
    if (variantRows.length && group.length !== variantRows.length) {
      err(line, 'mixes rows with and without variant columns for the same product');
    }

    const stockCell = (row: Row) => {
      const counted = num(row.cells.stock, 'stock', row.line, true);
      if (counted !== undefined && !tracks) err(row.line, "has stock but the product doesn't track stock");
      return counted;
    };

    for (const row of variantRows) {
      const c = row.cells;
      const vPrice = num(c.variant_price, 'variant_price', row.line);
      const counted = stockCell(row);
      const match = existing?.variants?.find((v) =>
        c.variant_id ? String(v._id) === c.variant_id : !!c.variant_label && v.label.toLowerCase() === c.variant_label.toLowerCase(),
      );
      if (c.variant_id && !match) {
        err(row.line, `no variant with id ${c.variant_id} on this product`);
        continue;
      }
      if (match) {
        const set: Record<string, unknown> = {};
        if (c.variant_label && c.variant_label !== match.label) set['variants.$.label'] = c.variant_label;
        if (vPrice !== undefined && vPrice !== match.price) set['variants.$.price'] = vPrice;
        if (c.variant_sku && c.variant_sku !== match.sku) set['variants.$.sku'] = c.variant_sku;
        if (Object.keys(set).length) {
          plan.variantSets.push({ variantId: String(match._id), set });
          changes.push(`variant "${match.label}": ${Object.keys(set).map((k) => k.replace('variants.$.', '')).join(', ')}`);
        }
        if (counted !== undefined && counted !== match.stock) {
          plan.stock.push({ variantId: String(match._id), counted });
          changes.push(`variant "${match.label}" stock ${match.stock} → ${counted}`);
        }
      } else if (c.variant_label) {
        plan.newVariants.push({ label: c.variant_label, price: vPrice, sku: c.variant_sku || undefined });
        if (counted !== undefined) plan.stock.push({ variantLabel: c.variant_label, counted });
        changes.push(`new variant "${c.variant_label}"`);
      } else {
        err(row.line, 'a new variant needs a variant_label');
      }
    }

    if (!variantRows.length) {
      const counted = stockCell(group[0]);
      if (counted !== undefined && existing?.variants?.length) {
        err(line, 'this product has variants — put stock on its variant rows');
      } else if (counted !== undefined && counted !== (existing?.stock ?? -1)) {
        plan.stock.push({ counted });
        if (existing) changes.push(`stock ${existing.stock} → ${counted}`);
      }
    }

    // ── Create or update ──
    if (!existing) {
      if (!first.name_en && !first.name_ar) err(line, 'a new product needs name_en or name_ar');
      if (!wanted.category) err(line, 'a new product needs a category');
      plan.create = {
        name: { en: first.name_en || first.name_ar || '', ar: first.name_ar || first.name_en || '' },
        shortDescription:
          first.short_description_en || first.short_description_ar
            ? { en: first.short_description_en ?? '', ar: first.short_description_ar ?? '' }
            : undefined,
        slug: first.slug?.toLowerCase() || undefined,
        category: String(wanted.category ?? ''),
        subCategory: wanted.subCategory ? String(wanted.subCategory) : undefined,
        tags: wanted.tags as string[] | undefined,
        price: wanted.price as number | undefined,
        sku: wanted.sku as string | undefined,
        isActive: isActive ?? true,
        trackStock: trackStock ?? true,
        allowBackorder: allowBackorder ?? false,
        lowStockThreshold: threshold,
        stock: plan.stock.find((s) => !s.variantLabel)?.counted,
        variants: plan.newVariants.map((v) => ({
          ...v,
          stock: plan.stock.find((s) => s.variantLabel === v.label)?.counted,
        })),
      } as CreateProductDto;
      plan.report.action = errors.length ? 'error' : 'create';
      return plan;
    }

    // Only fields that actually differ count as changes.
    const current = existing.toObject() as Record<string, any>;
    const read = (path: string) => path.split('.').reduce((o, k) => o?.[k], current);
    for (const [path, value] of Object.entries(wanted)) {
      const before = read(path);
      const differs = Array.isArray(value)
        ? JSON.stringify(value) !== JSON.stringify(before ?? [])
        : value instanceof Types.ObjectId || path === 'category' || path === 'subCategory'
          ? !sameId(before, value)
          : before !== value;
      if (differs) {
        plan.set[path] = value;
        changes.push(path);
      }
    }

    plan.report.action = errors.length ? 'error' : changes.length ? 'update' : 'unchanged';
    return plan;
  }

  private async execute(plan: Plan, userId?: string): Promise<void> {
    if (plan.report.action === 'unchanged') return;

    if (plan.create) {
      // Through ProductsService, so the slug and opening stock follow the usual rules.
      await this.productsService.create(plan.create, [], userId);
      return;
    }

    const product = plan.existing!;
    if (Object.keys(plan.set).length) {
      if (plan.set.slug && (await this.productModel.exists({ slug: plan.set.slug, _id: { $ne: product._id } }))) {
        throw new BadRequestException(`slug "${String(plan.set.slug)}" is already used by another product`);
      }
      await this.productModel.updateOne({ _id: product._id }, { $set: plan.set }).exec();
    }
    // Targeted writes, never a whole-array save: a sale landing meanwhile keeps its stock.
    for (const { variantId, set } of plan.variantSets) {
      await this.productModel.updateOne({ _id: product._id, 'variants._id': variantId }, { $set: set }).exec();
    }
    if (plan.newVariants.length) {
      await this.productModel
        .updateOne({ _id: product._id }, { $push: { variants: { $each: plan.newVariants.map((v) => ({ ...v, stock: 0 })) } } })
        .exec();
    }

    const fresh = plan.stock.some((s) => s.variantLabel)
      ? await this.productModel.findById(product._id).select('variants').lean().exec()
      : null;
    for (const target of plan.stock) {
      const variantId =
        target.variantId ?? (target.variantLabel ? String(fresh?.variants?.find((v) => v.label === target.variantLabel)?._id ?? '') : undefined);
      // The ledger records the difference as a stock-take adjustment.
      await this.inventoryService.stockTake(
        { productId: String(product._id), variantId: variantId || undefined, countedQuantity: target.counted, reason: 'CSV import' },
        userId,
      );
    }
  }
}
