import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, QueryFilter, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { allocate, formatMinor, MoneyError, mulDiv, parseMoney } from '../common/money/money';
import { Product } from '../products/schemas/product.schema';
import { Counter } from '../orders/schemas/counter.schema';
import { InventoryService, varianceLines } from '../inventory/inventory.service';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { Supplier } from './schemas/supplier.schema';
import { Purchase, PurchaseLine, PurchaseStatus } from './schemas/purchase.schema';
import { PurchaseReturn } from './schemas/purchase-return.schema';
import { SupplierPayment } from './schemas/supplier-payment.schema';
import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  CreateSupplierPaymentDto,
  QueryPurchasesDto,
  UpdatePurchaseDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto';

/** Human-facing numbers, so a purchase, a supplier return and a payment never read alike. */
const NUMBERS = {
  purchase: { counter: 'purchase', base: 4000 },
  purchaseReturn: { counter: 'purchase_return', base: 5000 },
  supplierPayment: { counter: 'supplier_payment', base: 6000 },
};

/** What is still owed on a posted purchase. */
const owedOn = (p: Pick<Purchase, 'totalMinor' | 'paidMinor' | 'returnedMinor'>) => p.totalMinor - p.paidMinor - p.returnedMinor;

@Injectable()
export class PurchasingService {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
    @InjectModel(Purchase.name) private purchaseModel: Model<Purchase>,
    @InjectModel(PurchaseReturn.name) private returnModel: Model<PurchaseReturn>,
    @InjectModel(SupplierPayment.name) private paymentModel: Model<SupplierPayment>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly inventory: InventoryService,
    private readonly journal: JournalService,
  ) {}

  // ── Suppliers ───────────────────────────────────────────────────────────────

  createSupplier(dto: CreateSupplierDto) {
    return this.supplierModel.create(dto);
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.supplierModel.findByIdAndUpdate(this.oid(id, 'Supplier'), dto, { returnDocument: 'after', runValidators: true }).exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  /** Every supplier with what the store owes them now. */
  async suppliers() {
    const [suppliers, owed] = await Promise.all([
      this.supplierModel.find().sort({ name: 1 }).lean().exec(),
      this.purchaseModel
        .aggregate<{ _id: Types.ObjectId; owedMinor: number; purchases: number }>([
          { $match: { status: PurchaseStatus.POSTED } },
          {
            $group: {
              _id: '$supplier',
              owedMinor: { $sum: { $subtract: ['$totalMinor', { $add: ['$paidMinor', '$returnedMinor'] }] } },
              purchases: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);
    const bySupplier = new Map(owed.map((row) => [String(row._id), row]));
    return suppliers.map((s) => ({
      ...s,
      owedMinor: bySupplier.get(String(s._id))?.owedMinor ?? 0,
      purchases: bySupplier.get(String(s._id))?.purchases ?? 0,
    }));
  }

  /** One supplier with their purchases, returns and payments. */
  async supplier(id: string) {
    const supplier = await this.supplierModel.findById(this.oid(id, 'Supplier')).lean().exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    const [purchases, returns, payments] = await Promise.all([
      this.purchaseModel.find({ supplier: supplier._id }).sort({ date: -1 }).lean().exec(),
      this.returnModel.find({ supplier: supplier._id }).sort({ date: -1 }).lean().exec(),
      this.paymentModel.find({ supplier: supplier._id }).sort({ date: -1 }).lean().exec(),
    ]);
    const owedMinor = purchases.filter((p) => p.status === PurchaseStatus.POSTED).reduce((t, p) => t + owedOn(p), 0);
    return { ...supplier, owedMinor, purchases, returns, payments };
  }

  // ── Purchases ───────────────────────────────────────────────────────────────

  /** A draft: nothing moves until it is posted. */
  async createPurchase(dto: CreatePurchaseDto, userId?: string) {
    const fields = await this.draftFields(dto);
    const [purchase] = await withTransaction(this.connection, async (session) =>
      this.purchaseModel.create(
        [{ ...fields, purchaseNumber: await this.next('purchase', session), status: PurchaseStatus.DRAFT, createdBy: this.userOid(userId) }],
        { session },
      ),
    );
    return purchase;
  }

  async updatePurchase(id: string, dto: UpdatePurchaseDto) {
    const purchase = await this.findPurchase(id);
    if (purchase.status !== PurchaseStatus.DRAFT) throw new ConflictException('A posted purchase is fixed; send goods back with a purchase return');
    const fields = await this.draftFields({
      supplierId: dto.supplierId ?? String(purchase.supplier),
      supplierInvoiceNo: dto.supplierInvoiceNo ?? purchase.supplierInvoiceNo,
      date: dto.date ?? purchase.date.toISOString(),
      dueDate: dto.dueDate ?? purchase.dueDate?.toISOString(),
      notes: dto.notes ?? purchase.notes,
      landedCost: dto.landedCost ?? formatMinor(purchase.landedCostMinor),
      lines:
        dto.lines ??
        purchase.lines.map((l) => ({
          productId: String(l.product),
          variantId: l.variantId ? String(l.variantId) : undefined,
          quantity: l.quantity,
          unitCost: formatMinor(l.unitCostMinor),
        })),
    });
    const updated = await this.purchaseModel
      .findOneAndUpdate({ _id: purchase._id, status: PurchaseStatus.DRAFT }, { $set: fields }, { returnDocument: 'after' })
      .exec();
    if (!updated) throw new ConflictException('This purchase was just posted; reload it');
    return updated;
  }

  async deletePurchase(id: string) {
    const deleted = await this.purchaseModel.findOneAndDelete({ _id: this.oid(id, 'Purchase'), status: PurchaseStatus.DRAFT }).exec();
    if (!deleted) throw new ConflictException('Only a draft purchase can be deleted');
    return deleted;
  }

  /**
   * Receives the goods, as one transaction: freight is split across the lines
   * by value, each line goes into stock at its cost (settling any shortfall
   * sold earlier at an estimate), and the supplier is owed the total. Dated
   * when the goods were received.
   */
  async postPurchase(id: string, userId?: string) {
    return withTransaction(this.connection, async (session) => {
      const purchase = await this.purchaseModel
        .findOneAndUpdate(
          { _id: this.oid(id, 'Purchase'), status: PurchaseStatus.DRAFT },
          { $set: { status: PurchaseStatus.POSTED, postedAt: new Date(), postedBy: this.userOid(userId) } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!purchase) {
        if (!(await this.purchaseModel.exists({ _id: id }).session(session))) throw new NotFoundException('Purchase not found');
        throw new ConflictException('This purchase is already posted');
      }

      let intoStock = 0;
      let variance = 0;
      for (const line of purchase.lines) {
        const movement = await this.inventory
          .adjust(
            {
              productId: String(line.product),
              variantId: line.variantId ? String(line.variantId) : undefined,
              type: MovementType.PURCHASE,
              quantity: line.quantity,
              reference: `Purchase #${purchase.purchaseNumber}${purchase.supplierInvoiceNo ? ` (invoice ${purchase.supplierInvoiceNo})` : ''}`,
            },
            userId,
            session,
            line.valueMinor,
          )
          .catch((error: Error) => {
            // Name the line on our own refusals; anything else (a write conflict
            // the transaction retries on) must pass through untouched.
            if (!(error instanceof BadRequestException || error instanceof NotFoundException)) throw error;
            throw new BadRequestException(`${purchaseLineLabel(line)}: ${error.message}`);
          });
        intoStock += movement.valueMinor ?? 0;
        variance += movement.varianceMinor ?? 0;
      }

      await this.journal.post(
        {
          date: purchase.date,
          source: { type: 'purchase', id: purchase._id as Types.ObjectId, number: purchase.purchaseNumber, event: 'posted' },
          // The supplier is owed the full total; stock takes it, less any part
          // that settles units sold short earlier (that part is cost of goods sold).
          lines: [
            { account: ACCOUNT.INVENTORY, debitMinor: intoStock },
            { account: ACCOUNT.PAYABLES, creditMinor: purchase.totalMinor },
            ...varianceLines(variance),
          ],
          memo: `Purchase #${purchase.purchaseNumber}`,
          createdBy: userId,
        },
        session,
      );
      return purchase;
    });
  }

  async purchases(query: QueryPurchasesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const filter: QueryFilter<Purchase> = {};
    if (query.supplierId) filter.supplier = this.oid(query.supplierId, 'Supplier');
    if (query.status) filter.status = query.status as PurchaseStatus;
    const [data, total] = await Promise.all([
      this.purchaseModel.find(filter).sort({ date: -1, purchaseNumber: -1 }).skip((page - 1) * limit).limit(limit).populate('supplier', 'name').exec(),
      this.purchaseModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async purchase(id: string) {
    const purchase = await this.purchaseModel.findById(this.oid(id, 'Purchase')).populate('supplier', 'name phone').exec();
    if (!purchase) throw new NotFoundException('Purchase not found');
    const [returns, payments] = await Promise.all([
      this.returnModel.find({ purchase: purchase._id }).sort({ date: 1 }).lean().exec(),
      this.paymentModel.find({ 'allocations.purchase': purchase._id }).sort({ date: 1 }).lean().exec(),
    ]);
    return { ...purchase.toObject(), owedMinor: owedOn(purchase), returns, payments };
  }

  // ── Returns to the supplier ─────────────────────────────────────────────────

  /**
   * Sends goods back, as one transaction: they leave stock at what they were
   * bought for (not today's average), and that comes off what the store owes
   * the supplier. Only units actually on the shelf can go back.
   */
  async returnToSupplier(dto: CreatePurchaseReturnDto, userId?: string) {
    const date = this.date(dto.date);
    return withTransaction(this.connection, async (session) => {
      const purchase = await this.purchaseModel.findById(this.oid(dto.purchaseId, 'Purchase')).session(session).exec();
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status !== PurchaseStatus.POSTED) throw new ConflictException('Only a posted purchase can have goods returned');

      const seen = new Set<number>();
      const lines = dto.lines.map((input) => {
        const line = purchase.lines[input.lineIndex];
        if (!line) throw new BadRequestException(`Purchase has no line ${input.lineIndex + 1}`);
        if (seen.has(input.lineIndex)) throw new BadRequestException(`Line ${input.lineIndex + 1} is listed twice`);
        seen.add(input.lineIndex);
        const left = line.quantity - line.returnedQty;
        if (input.quantity > left) throw new BadRequestException(`Only ${left} of line ${input.lineIndex + 1} can still go back`);
        // The last units back take exactly what is left of the line's value.
        const valueMinor = input.quantity === left ? line.valueMinor - line.returnedMinor : mulDiv(line.valueMinor, input.quantity, line.quantity);
        return { lineIndex: input.lineIndex, quantity: input.quantity, valueMinor, line };
      });
      const totalMinor = lines.reduce((t, l) => t + l.valueMinor, 0);
      if (totalMinor <= 0) throw new BadRequestException('A return must take something back');

      const [ret] = await this.returnModel.create(
        [
          {
            returnNumber: await this.next('purchaseReturn', session),
            purchase: purchase._id,
            purchaseNumber: purchase.purchaseNumber,
            supplier: purchase.supplier,
            date,
            lines: lines.map(({ line, ...l }) => l),
            totalMinor,
            note: dto.note,
            createdBy: this.userOid(userId),
          },
        ],
        { session },
      );

      let variance = 0;
      let outOfStock = 0;
      for (const { line, quantity, valueMinor } of lines) {
        const product = await this.productModel.findById(line.product).session(session).lean().exec();
        const onHand = line.variantId
          ? product?.variants.find((v) => v._id.equals(line.variantId))?.stock ?? 0
          : product?.stock ?? 0;
        if (onHand < quantity) {
          throw new BadRequestException(`Only ${Math.max(onHand, 0)} unit(s) of line ${purchaseLineLabel(line)} are on the shelf to send back`);
        }
        const movement = await this.inventory.adjust(
          {
            productId: String(line.product),
            variantId: line.variantId ? String(line.variantId) : undefined,
            type: MovementType.PURCHASE_RETURN,
            quantity,
            reference: `Supplier return #${ret.returnNumber} (Purchase #${purchase.purchaseNumber})`,
          },
          userId,
          session,
          valueMinor,
        );
        variance += movement.varianceMinor ?? 0;
        outOfStock += -(movement.valueMinor ?? 0);
      }

      await this.purchaseModel
        .updateOne(
          { _id: purchase._id },
          {
            $inc: {
              returnedMinor: totalMinor,
              ...Object.fromEntries(
                lines.flatMap((l) => [
                  [`lines.${l.lineIndex}.returnedQty`, l.quantity],
                  [`lines.${l.lineIndex}.returnedMinor`, l.valueMinor],
                ]),
              ),
            },
          },
          { session },
        )
        .exec();

      await this.journal.post(
        {
          date,
          source: { type: 'purchase_return', id: ret._id as Types.ObjectId, number: ret.returnNumber, event: 'posted' },
          // Off what is owed at the purchase cost; out of stock at that plus
          // any value an emptied line had left over (variance, to COGS).
          lines: [
            { account: ACCOUNT.PAYABLES, debitMinor: totalMinor },
            { account: ACCOUNT.INVENTORY, creditMinor: outOfStock },
            ...varianceLines(variance),
          ],
          memo: `Goods back to supplier, purchase #${purchase.purchaseNumber}`,
          createdBy: userId,
        },
        session,
      );
      return ret;
    });
  }

  // ── Paying suppliers ────────────────────────────────────────────────────────

  /**
   * Pays a supplier from the store's cash, settling their oldest unpaid
   * purchases first. Never more than is owed: paying ahead isn't tracked yet.
   */
  async paySupplier(dto: CreateSupplierPaymentDto, userId?: string) {
    const amountMinor = this.amount(dto.amount, 'amount');
    if (amountMinor <= 0) throw new BadRequestException('The amount must be above zero');
    const date = this.date(dto.date);

    return withTransaction(this.connection, async (session) => {
      const supplier = await this.supplierModel.findById(this.oid(dto.supplierId, 'Supplier')).session(session).exec();
      if (!supplier) throw new NotFoundException('Supplier not found');

      const open = (await this.purchaseModel.find({ supplier: supplier._id, status: PurchaseStatus.POSTED }).sort({ date: 1, purchaseNumber: 1 }).session(session).exec()).filter(
        (p) => owedOn(p) > 0,
      );
      const owed = open.reduce((t, p) => t + owedOn(p), 0);
      if (amountMinor > owed) throw new BadRequestException(`Only ${formatMinor(owed)} is owed to ${supplier.name}`);

      let left = amountMinor;
      const allocations: { purchase: Types.ObjectId; purchaseNumber: number; amountMinor: number }[] = [];
      for (const p of open) {
        if (!left) break;
        const take = Math.min(left, owedOn(p));
        allocations.push({ purchase: p._id as Types.ObjectId, purchaseNumber: p.purchaseNumber, amountMinor: take });
        left -= take;
      }

      const [payment] = await this.paymentModel.create(
        [
          {
            paymentNumber: await this.next('supplierPayment', session),
            supplier: supplier._id,
            date,
            amountMinor,
            allocations,
            note: dto.note,
            createdBy: this.userOid(userId),
          },
        ],
        { session },
      );
      for (const a of allocations) {
        await this.purchaseModel.updateOne({ _id: a.purchase }, { $inc: { paidMinor: a.amountMinor } }, { session }).exec();
      }

      await this.journal.post(
        {
          date,
          source: { type: 'supplier_payment', id: payment._id as Types.ObjectId, number: payment.paymentNumber, event: 'paid' },
          lines: [
            { account: ACCOUNT.PAYABLES, debitMinor: amountMinor },
            { account: ACCOUNT.CASH, creditMinor: amountMinor, moneyAccount: await this.journal.moneyAccount(dto.moneyAccountId, session) },
          ],
          memo: `Payment to ${supplier.name}`,
          createdBy: userId,
        },
        session,
      );
      return payment;
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Checks a draft's supplier and products and works out its amounts. */
  private async draftFields(dto: CreatePurchaseDto) {
    const supplier = await this.supplierModel.findById(this.oid(dto.supplierId, 'Supplier')).lean().exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!supplier.isActive) throw new BadRequestException(`${supplier.name} is inactive`);

    const ids = [...new Set(dto.lines.map((l) => l.productId))].map((id) => this.oid(id, 'Product'));
    const products = new Map((await this.productModel.find({ _id: { $in: ids } }).lean().exec()).map((p) => [String(p._id), p]));
    const lines = dto.lines.map((input, i) => {
      const product = products.get(input.productId);
      if (!product) throw new NotFoundException(`Line ${i + 1}: product not found`);
      if (!product.trackStock) throw new BadRequestException(`Line ${i + 1}: ${product.name.en ?? product.name.ar} doesn't track stock`);
      const hasVariants = (product.variants?.length ?? 0) > 0;
      const variant = input.variantId ? product.variants.find((v) => String(v._id) === input.variantId) : undefined;
      if (hasVariants ? !variant : !!input.variantId) {
        throw new BadRequestException(`Line ${i + 1}: ${hasVariants ? 'pick which variant was bought' : 'this product has no variants'}`);
      }
      return {
        product: product._id,
        variantId: variant?._id,
        name: product.name,
        variantLabel: variant?.label,
        quantity: input.quantity,
        unitCostMinor: this.amount(input.unitCost, `line ${i + 1} unit cost`),
      };
    });

    const totals = lines.map((l) => l.quantity * l.unitCostMinor);
    const subtotalMinor = totals.reduce((a, b) => a + b, 0);
    const landedCostMinor = dto.landedCost ? this.amount(dto.landedCost, 'landedCost') : 0;
    if (landedCostMinor > 0 && subtotalMinor === 0) throw new BadRequestException('Landed cost needs lines with a price to spread over');
    // Freight goes to the lines by value, largest remainder, so the shares add up exactly (example E8).
    const shares = landedCostMinor > 0 ? allocate(landedCostMinor, totals) : lines.map(() => 0);

    return {
      supplier: supplier._id,
      supplierInvoiceNo: dto.supplierInvoiceNo || undefined,
      date: this.date(dto.date),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      notes: dto.notes,
      lines: lines.map((l, i) => ({ ...l, landedMinor: shares[i], valueMinor: totals[i] + shares[i], returnedQty: 0, returnedMinor: 0 })),
      landedCostMinor,
      subtotalMinor,
      totalMinor: subtotalMinor + landedCostMinor,
    };
  }

  private async findPurchase(id: string) {
    const purchase = await this.purchaseModel.findById(this.oid(id, 'Purchase')).exec();
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  /** A business date: given or now, and never in the future. */
  private date(value?: string): Date {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Not a date');
    if (date.getTime() > Date.now() + 60_000) throw new BadRequestException('The date cannot be in the future');
    return date;
  }

  private amount(value: string, field: string): number {
    try {
      return parseMoney(value);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(`${field}: ${error.message}`);
      throw error;
    }
  }

  private async next(kind: keyof typeof NUMBERS, session: ClientSession): Promise<number> {
    const { counter, base } = NUMBERS[kind];
    const row = await this.counterModel
      .findOneAndUpdate({ name: counter }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      .exec();
    return base + row!.seq;
  }

  private oid(id: string, what: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`${what} not found`);
    return new Types.ObjectId(id);
  }

  private userOid(userId?: string): Types.ObjectId | undefined {
    return userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
  }
}

const purchaseLineLabel = (line: PurchaseLine) => `${line.name.en ?? line.name.ar}${line.variantLabel ? ` (${line.variantLabel})` : ''}`;
