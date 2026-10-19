import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { CreateProductDto, ProductVariantDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductSort, SearchProductsDto } from './dto/search-products.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';

export const productImageStorage = tenantImageStorage('products');

function buildSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
    userId?: string,
  ): Promise<Product> {
    if (typeof (createProductDto as any).variants === 'string') {
      try { createProductDto.variants = JSON.parse((createProductDto as any).variants); }
      catch { createProductDto.variants = []; }
    }

    if (files.length > 0) {
      const compressed = await Promise.all(
        files.map(async (f) => toPublicPath(await compressImage(f))),
      );
      createProductDto.images = [...(createProductDto.images ?? []), ...compressed];
    }

    if (!createProductDto.slug) {
      const base = createProductDto.name.en ?? createProductDto.name.ar ?? 'product';
      createProductDto.slug = await this.uniqueSlug(buildSlug(base));
    }

    // Save at zero and let the ledger put the opening stock in, so the stored
    // count is always the sum of its movements — never a number that appeared
    // from nowhere.
    const opening = {
      product: createProductDto.stock ?? 0,
      variants: (createProductDto.variants ?? []).map((v) => ({
        label: v.label,
        stock: v.stock ?? 0,
      })),
    };
    createProductDto.stock = 0;
    createProductDto.variants = (createProductDto.variants ?? []).map((v) => ({
      ...v,
      stock: 0,
    }));

    const product = new this.productModel(createProductDto);
    await product.save();

    await this.recordOpeningStock(product, opening.product, opening.variants, userId);

    return this.findOne(product._id!.toString());
  }

  async findAll(): Promise<Product[]> {
    return this.productModel
      .find()
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findActive(): Promise<Product[]> {
    return this.productModel
      .find({ isActive: true })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  /**
   * The storefront catalogue: active products only, filtered and sorted on the
   * server, one page at a time.
   *
   * Search is a case-insensitive substring match rather than a text index —
   * Mongo's text index matches whole words and has no Arabic stemming, so
   * typing part of an Arabic name would find nothing.
   */
  async search(query: SearchProductsDto): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Coerced here as well: the global ValidationPipe validates the
    // transformed DTO but hands the controller the raw query strings.
    const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
    const page = num(query.page) ?? 1;
    const limit = num(query.limit) ?? 24;
    const minPrice = num(query.minPrice);
    const maxPrice = num(query.maxPrice);
    const inStock = String(query.inStock) === 'true';

    // `category`/`subCategory` are declared with `type: Types.ObjectId`, which
    // Mongoose treats as Mixed, so stored ids may be strings or ObjectIds.
    const anyId = (id: string) => ({ $in: [id, new Types.ObjectId(id)] });
    const match: Record<string, unknown> = { isActive: true };
    if (query.categoryId) match.category = anyId(query.categoryId);
    if (query.subCategoryId) match.subCategory = anyId(query.subCategoryId);

    const term = query.q?.trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [
        { 'name.en': pattern },
        { 'name.ar': pattern },
        { tags: pattern },
        { sku: pattern },
        { 'variants.sku': pattern },
      ];
    }

    const derived: PipelineStage[] = [
      { $match: match },
      {
        $addFields: {
          // What the card shows: the cheapest variant, or the product price.
          effectivePrice: { $ifNull: [{ $min: '$variants.price' }, '$price'] },
          inStock: {
            $or: [
              { $eq: ['$trackStock', false] },
              { $eq: ['$allowBackorder', true] },
              { $gt: ['$stock', 0] },
              { $gt: [{ $max: '$variants.stock' }, 0] },
            ],
          },
        },
      },
    ];

    const filters: Record<string, unknown> = {};
    if (minPrice !== undefined || maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (minPrice !== undefined) range.$gte = minPrice;
      if (maxPrice !== undefined) range.$lte = maxPrice;
      filters.effectivePrice = range;
    }
    if (inStock) filters.inStock = true;
    if (Object.keys(filters).length) derived.push({ $match: filters });

    const sorts: Record<ProductSort, Record<string, 1 | -1>> = {
      [ProductSort.FEATURED]: { order: 1, createdAt: -1 },
      [ProductSort.NEWEST]: { createdAt: -1 },
      // `hasPrice` first so unpriced products sink to the end either way.
      [ProductSort.PRICE_ASC]: { hasPrice: -1, effectivePrice: 1, createdAt: -1 },
      [ProductSort.PRICE_DESC]: { hasPrice: -1, effectivePrice: -1, createdAt: -1 },
    };

    const [result] = await this.productModel
      .aggregate<{ data: Product[]; total: { count: number }[] }>([
        ...derived,
        {
          $facet: {
            data: [
              { $addFields: { hasPrice: { $ne: [{ $ifNull: ['$effectivePrice', null] }, null] } } },
              { $sort: { ...sorts[query.sort ?? ProductSort.FEATURED], _id: 1 } },
              { $skip: (page - 1) * limit },
              { $limit: limit },
              {
                $lookup: {
                  from: 'categories',
                  let: { categoryId: { $convert: { input: '$category', to: 'objectId', onError: null, onNull: null } } },
                  as: 'category',
                  pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
                    { $project: { name: 1, slug: 1 } },
                  ],
                },
              },
              { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
              { $project: { description: 0, hasPrice: 0, views: 0, whatsappClicks: 0 } },
            ],
            total: [{ $count: 'count' }],
          },
        },
      ])
      .exec();

    return { data: result.data, total: result.total[0]?.count ?? 0, page, limit };
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.productModel
      .find({ category: categoryId })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findBySubCategory(subCategoryId: string): Promise<Product[]> {
    return this.productModel
      .find({ subCategory: subCategoryId })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec();
    if (!product) throw new NotFoundException(`Product with id ${id} not found`);
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productModel
      .findOne({ slug })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec();
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    files: Express.Multer.File[],
    userId?: string,
  ): Promise<Product> {
    if (typeof (updateProductDto as any).variants === 'string') {
      try { updateProductDto.variants = JSON.parse((updateProductDto as any).variants); }
      catch { updateProductDto.variants = []; }
    }

    const existing = await this.productModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Product with id ${id} not found`);

    // Stock is ledger-owned. Editing a product must never move it, so drop the
    // product-level figure and re-attach each existing variant's real stock —
    // the incoming variants array replaces the stored one wholesale, and
    // whatever the form sent back is stale by definition.
    delete (updateProductDto as { stock?: number }).stock;

    let addedVariants: ProductVariantDto[] = [];
    if (updateProductDto.variants) {
      const { merged, added } = this.mergeVariantStock(existing, updateProductDto.variants);
      updateProductDto.variants = merged;
      addedVariants = added;
    }

    // Delete images removed by the client (were in DB but not in the new kept list)
    const keptImages = updateProductDto.images ?? [];
    const removedImages = (existing.images ?? []).filter((img) => !keptImages.includes(img));
    await Promise.all(removedImages.map(deleteFile));

    if (files.length > 0) {
      const compressed = await Promise.all(
        files.map(async (f) => toPublicPath(await compressImage(f))),
      );
      updateProductDto.images = [...keptImages, ...compressed];
    }

    const updated = (await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { returnDocument: 'after' })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .exec()) as Product;

    // Variants added during this edit get their opening stock through the
    // ledger too. They were stored at zero above, so this is what fills them.
    if (addedVariants.length > 0) {
      await this.recordOpeningStock(
        updated,
        0,
        addedVariants.map((v) => ({ label: v.label, stock: v.stock ?? 0 })),
        userId,
      );
      return this.findOne(id);
    }

    return updated;
  }

  async incrementViews(slug: string): Promise<Product> {
    const product = await this.productModel
      .findOneAndUpdate({ slug }, { $inc: { views: 1 } }, { new: true })
      .exec();
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  async incrementWhatsappClicks(slug: string): Promise<Product> {
    const product = await this.productModel
      .findOneAndUpdate({ slug }, { $inc: { whatsappClicks: 1 } }, { new: true })
      .exec();
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  async remove(id: string): Promise<Product> {
    const product = await this.productModel.findByIdAndDelete(id).exec();
    if (!product) throw new NotFoundException(`Product with id ${id} not found`);
    return product;
  }

  /**
   * Keeps every existing variant's stock at whatever the ledger says, ignoring
   * the value the edit form sent back — that number was read when the form
   * opened and may be minutes stale. Only brand-new variants (no `_id`) get to
   * declare stock, and even then it lands as an OPENING movement.
   */
  private mergeVariantStock(
    existing: Product,
    incoming: ProductVariantDto[],
  ): { merged: ProductVariantDto[]; added: ProductVariantDto[] } {
    const stockById = new Map(
      (existing.variants ?? []).map((v) => [v._id.toString(), v.stock ?? 0]),
    );

    const added: ProductVariantDto[] = [];
    const merged = incoming.map((variant) => {
      if (variant._id && stockById.has(variant._id)) {
        return { ...variant, stock: stockById.get(variant._id) };
      }
      added.push(variant);
      return { ...variant, stock: 0 };
    });

    return { merged, added };
  }

  /** Writes the OPENING movements that fill a freshly created product or variant. */
  private async recordOpeningStock(
    product: Product,
    productStock: number,
    variants: { label: string; stock: number }[],
    userId?: string,
  ): Promise<void> {
    if (!product.trackStock) return;

    const productId = product._id!.toString();
    const hasVariants = (product.variants?.length ?? 0) > 0;

    if (!hasVariants && productStock > 0) {
      await this.inventoryService.adjust(
        {
          productId,
          type: MovementType.OPENING,
          quantity: productStock,
          reason: 'Opening stock',
        },
        userId,
      );
      return;
    }

    for (const opening of variants) {
      if (opening.stock <= 0) continue;

      // Variant ids only exist after the save, so match on the label the
      // admin typed.
      const saved = product.variants.find((v) => v.label === opening.label);
      if (!saved) continue;

      await this.inventoryService.adjust(
        {
          productId,
          variantId: saved._id.toString(),
          type: MovementType.OPENING,
          quantity: opening.stock,
          reason: 'Opening stock',
        },
        userId,
      );
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let count = 0;
    while (await this.productModel.exists({ slug })) {
      count++;
      slug = `${base}-${count}`;
    }
    return slug;
  }
}
