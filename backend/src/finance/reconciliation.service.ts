import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JournalEntry } from './schemas/journal-entry.schema';
import { CollectionStatus, Custody, Payment } from './schemas/payment.schema';
import { Order } from '../orders/schemas/order.schema';
import { Coupon } from '../coupons/schemas/coupon.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { ACCOUNT } from './accounts';
import { JournalService } from './journal.service';
import { amountProblems, orderAmounts, outstandingOf, toMajor } from './order-money';
import { Refund, RefundMethod, RefundStatus } from '../refunds/schemas/refund.schema';
import { Product } from '../products/schemas/product.schema';
import { StockMovement } from '../inventory/schemas/stock-movement.schema';
import { Purchase, PurchaseStatus } from '../purchasing/schemas/purchase.schema';
import { Expense, ExpenseStatus } from '../expenses/schemas/expense.schema';
import { CourierSettlement } from '../couriers/schemas/courier-settlement.schema';
import { EXPENSE_ACCOUNTS } from './accounts';

export interface ReconciliationCheck {
  name: string;
  ok: boolean;
  /** What was compared, in words and minor units. */
  detail: string;
  /** Up to 20 documents that break it. */
  offenders: string[];
}

export interface ReconciliationReport {
  ok: boolean;
  checkedAt: Date;
  checks: ReconciliationCheck[];
}

const MAX_OFFENDERS = 20;

/**
 * Proves the books agree with the documents they came from. Each check
 * recomputes a figure two independent ways — from the journal and from the
 * orders, payments or coupons — and names whatever disagrees. Read-only.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(Refund.name) private refundModel: Model<Refund>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovement>,
    @InjectModel(Purchase.name) private purchaseModel: Model<Purchase>,
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    @InjectModel(CourierSettlement.name) private settlementModel: Model<CourierSettlement>,
    private readonly journal: JournalService,
  ) {}

  async run(): Promise<ReconciliationReport> {
    const [booked, payments, refunds, balances] = await Promise.all([
      this.orderModel.find({ bookedAt: { $exists: true } }).lean().exec(),
      this.paymentModel.find({ status: CollectionStatus.COLLECTED }).lean().exec(),
      this.refundModel.find({ status: RefundStatus.EXECUTED }).lean().exec(),
      this.journal.balances(),
    ]);

    const checks: ReconciliationCheck[] = [];
    const check = (name: string, offenders: string[], detail: string) =>
      checks.push({ name, ok: offenders.length === 0, detail, offenders: offenders.slice(0, MAX_OFFENDERS) });

    // 1. Every entry balances.
    const unbalanced = await this.entryModel
      .aggregate<{ entryNumber: number }>([
        { $project: { entryNumber: 1, d: { $sum: '$lines.debitMinor' }, c: { $sum: '$lines.creditMinor' } } },
        { $match: { $expr: { $ne: ['$d', '$c'] } } },
      ])
      .exec();
    check('Every journal entry balances', unbalanced.map((e) => `entry #${e.entryNumber}`), 'Σ debits = Σ credits per entry');

    // 2. Order arithmetic, in minor units and against the pounds shown on screen.
    const amounts = new Map<string, ReturnType<typeof orderAmounts>>();
    const badMath: string[] = [];
    for (const o of booked) {
      try {
        const a = orderAmounts(o);
        amounts.set(String(o._id), a);
        const problems = amountProblems(a);
        if (toMajor(a.totalMinor) !== o.total) problems.push('total in pounds');
        if (problems.length) badMath.push(`order #${o.orderNumber}: ${problems.join(', ')}`);
      } catch (error) {
        badMath.push(`order #${o.orderNumber}: ${(error as Error).message}`);
      }
    }
    check('Booked orders add up', badMath, 'line = price × qty; subtotal = Σ lines; Σ line discounts = discount; total = subtotal − discount + delivery + tax');

    // 3. Sales, discounts and delivery income in the books equal the booked orders.
    const sum = (pick: (a: ReturnType<typeof orderAmounts>) => number) =>
      [...amounts.values()].reduce((total, a) => total + pick(a), 0);
    for (const [name, account, pick] of [
      ['Product sales equal booked subtotals', ACCOUNT.PRODUCT_SALES, (a) => a.subtotalMinor],
      ['Discounts equal booked discounts', ACCOUNT.SALES_DISCOUNTS, (a) => a.discountMinor],
      ['Delivery income equals booked delivery fees', ACCOUNT.DELIVERY_INCOME, (a) => a.shippingFeeMinor],
    ] as const) {
      const books = balances[account];
      const docs = sum(pick);
      check(name, books === docs ? [] : [`journal ${books} ≠ orders ${docs}`], `account ${account} = ${docs}`);
    }

    // 4. Every booked order has its delivery entry, and every delivery entry its order.
    const deliveryEntries = await this.entryModel
      .find({ 'source.type': 'order', 'source.event': 'delivered' })
      .select('source')
      .lean()
      .exec();
    const entryIds = new Set(deliveryEntries.map((e) => String(e.source.id)));
    const bookedIds = new Set(booked.map((o) => String(o._id)));
    check(
      'Each booked order has exactly its delivery entry',
      [
        ...booked.filter((o) => !entryIds.has(String(o._id)) && (o.totalMinor ?? o.total) > 0).map((o) => `order #${o.orderNumber} has no entry`),
        ...deliveryEntries.filter((e) => !bookedIds.has(String(e.source.id))).map((e) => `entry for order #${e.source.number} has no booked order`),
      ],
      'orders with bookedAt ↔ "delivered" entries',
    );

    // 5. Each order's collected total is the sum of its live payments.
    const paidByOrder = new Map<string, number>();
    for (const p of payments) paidByOrder.set(String(p.order), (paidByOrder.get(String(p.order)) ?? 0) + p.amountMinor);
    check(
      'Order collections match their payments',
      booked
        .filter((o) => (o.money?.collectedMinor ?? 0) !== (paidByOrder.get(String(o._id)) ?? 0))
        .map((o) => `order #${o.orderNumber}: ${o.money?.collectedMinor ?? 0} ≠ ${paidByOrder.get(String(o._id)) ?? 0}`),
      'order.money.collectedMinor = Σ collected payments',
    );

    // 6. Receivables in the books equal what booked orders still owe.
    const owed = booked.reduce((total, o) => {
      const a = amounts.get(String(o._id));
      return a ? total + outstandingOf(a.totalMinor, o.money) : total;
    }, 0);
    const receivables = balances[ACCOUNT.RECEIVABLES];
    check(
      'Receivables equal what customers owe',
      receivables === owed ? [] : [`journal ${receivables} ≠ orders ${owed}`],
      `account ${ACCOUNT.RECEIVABLES} = Σ (total − collected) of booked orders = ${owed}`,
    );

    // 7. Cash held by couriers equals what they collected less what they paid out as refunds, not yet settled.
    const withCouriers =
      payments.filter((p) => p.custody === Custody.COURIER && !p.settlement).reduce((t, p) => t + p.amountMinor, 0) -
      refunds.filter((r) => r.method === RefundMethod.COURIER_CASH && !r.settlement).reduce((t, r) => t + r.totalMinor, 0);
    const custody = balances[ACCOUNT.COURIER_CASH];
    check(
      'Courier cash equals their collections',
      custody === withCouriers ? [] : [`journal ${custody} ≠ payments ${withCouriers}`],
      `account ${ACCOUNT.COURIER_CASH} = Σ courier-held collections = ${withCouriers}`,
    );

    // 9. Each order's refund figures are the sum of its executed refunds, and no line gives back more than was paid for it.
    const byOrder = new Map<string, typeof refunds>();
    for (const r of refunds) byOrder.set(String(r.order), [...(byOrder.get(String(r.order)) ?? []), r]);
    const refundBreaks: string[] = [];
    for (const o of booked) {
      const mine = byOrder.get(String(o._id)) ?? [];
      const total = (pick: (r: (typeof refunds)[number]) => number, only?: (r: (typeof refunds)[number]) => boolean) =>
        mine.filter((r) => !only || only(r)).reduce((t, r) => t + pick(r), 0);
      const expected = {
        refundedMinor: total((r) => r.totalMinor),
        cashRefundedMinor: total((r) => r.totalMinor, (r) => r.method !== RefundMethod.CREDIT_AGAINST_RECEIVABLE),
        creditedMinor: total((r) => r.totalMinor, (r) => r.method === RefundMethod.CREDIT_AGAINST_RECEIVABLE),
        deliveryRefundedMinor: total((r) => r.deliveryMinor),
      };
      for (const [field, value] of Object.entries(expected)) {
        const stored = (o.money as unknown as Record<string, number> | undefined)?.[field] ?? 0;
        if (stored !== value) refundBreaks.push(`order #${o.orderNumber}: ${field} ${stored} ≠ refunds ${value}`);
      }
      const a = amounts.get(String(o._id));
      if (a && expected.refundedMinor > a.totalMinor) refundBreaks.push(`order #${o.orderNumber}: refunded more than its total`);
      a?.lines.forEach((line, i) => {
        const given = mine.flatMap((r) => r.lines).filter((l) => l.lineIndex === i).reduce((t, l) => t + l.amountMinor, 0);
        if (given > line.lineTotalMinor - line.discountMinor) refundBreaks.push(`order #${o.orderNumber} line ${i + 1}: refunded past its net`);
      });
    }
    check('Order refunds match their refund records', refundBreaks, 'order.money refund figures = Σ executed refunds; each ≤ what was paid');

    // 10. Returns and delivery-fee refunds in the books equal the executed refunds.
    for (const [name, account, pick] of [
      ['Sales returns equal executed product refunds', ACCOUNT.SALES_RETURNS, (r: Refund) => r.productMinor],
      ['Delivery-fee refunds equal executed delivery refunds', ACCOUNT.DELIVERY_REFUNDS, (r: Refund) => r.deliveryMinor],
    ] as const) {
      const books = balances[account];
      const docs = refunds.reduce((t, r) => t + pick(r as unknown as Refund), 0);
      check(name, books === docs ? [] : [`journal ${books} ≠ refunds ${docs}`], `account ${account} = ${docs}`);
    }

    // 11. Inventory in the books equals the value of every costed pool, and each pool's value its movements.
    const products = await this.productModel.find({ trackStock: true }).select('name stock inventoryValueMinor variants').lean().exec();
    const pools = products.flatMap((p) =>
      p.variants?.length
        ? p.variants.map((v) => ({ product: p._id, variantId: v._id as unknown, label: `${p.name?.en ?? p.name?.ar} (${v.label})`, value: v.inventoryValueMinor }))
        : [{ product: p._id, variantId: undefined as unknown, label: p.name?.en ?? p.name?.ar ?? String(p._id), value: p.inventoryValueMinor }],
    );
    const valued = pools.filter((pool) => pool.value !== undefined && pool.value !== null);
    const stockValue = valued.reduce((t, pool) => t + (pool.value as number), 0);
    check(
      'Inventory equals the value of stock on hand',
      balances[ACCOUNT.INVENTORY] === stockValue ? [] : [`journal ${balances[ACCOUNT.INVENTORY]} ≠ stock ${stockValue}`],
      `account ${ACCOUNT.INVENTORY} = Σ inventoryValueMinor of costed stock = ${stockValue}`,
    );
    const moved = await this.movementModel
      .aggregate<{ _id: { product: unknown; variantId?: unknown }; value: number }>([
        { $match: { valueMinor: { $exists: true } } },
        { $group: { _id: { product: '$product', variantId: '$variantId' }, value: { $sum: '$valueMinor' } } },
      ])
      .exec();
    const movedBy = new Map(moved.map((m) => [`${m._id.product}:${m._id.variantId ?? ''}`, m.value]));
    check(
      "Each product's value equals its movements",
      valued
        .filter((pool) => (movedBy.get(`${pool.product}:${pool.variantId ?? ''}`) ?? 0) !== pool.value)
        .map((pool) => `${pool.label}: ${pool.value} ≠ movements ${movedBy.get(`${pool.product}:${pool.variantId ?? ''}`) ?? 0}`),
      'inventoryValueMinor = Σ movement valueMinor, per product or variant',
    );

    // 12. Goods awaiting delivery equal the cost reserved by open orders.
    const open = await this.orderModel
      .aggregate<{ total: number }>([
        { $match: { status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED] } } },
        { $unwind: '$items' },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$items.costMinor', 0] } } } },
      ])
      .exec();
    const reserved = open[0]?.total ?? 0;
    check(
      'Goods awaiting delivery equal open orders at cost',
      balances[ACCOUNT.GOODS_AWAITING_DELIVERY] === reserved ? [] : [`journal ${balances[ACCOUNT.GOODS_AWAITING_DELIVERY]} ≠ open orders ${reserved}`],
      `account ${ACCOUNT.GOODS_AWAITING_DELIVERY} = Σ line cost of pending, confirmed and shipped orders = ${reserved}`,
    );

    // 13. Supplier payables equal what posted purchases still owe.
    const owedRows = await this.purchaseModel
      .aggregate<{ owed: number }>([
        { $match: { status: PurchaseStatus.POSTED } },
        { $group: { _id: null, owed: { $sum: { $subtract: ['$totalMinor', { $add: ['$paidMinor', '$returnedMinor'] }] } } } },
      ])
      .exec();
    const owedToSuppliers = owedRows[0]?.owed ?? 0;
    check(
      'Supplier payables equal what purchases still owe',
      balances[ACCOUNT.PAYABLES] === owedToSuppliers ? [] : [`journal ${balances[ACCOUNT.PAYABLES]} ≠ purchases ${owedToSuppliers}`],
      `account ${ACCOUNT.PAYABLES} = Σ (total − paid − returned) of posted purchases = ${owedToSuppliers}`,
    );

    // 14. Write-offs in the books equal what orders wrote off.
    const writtenOff = booked.reduce((t, o) => t + (o.money?.writtenOffMinor ?? 0), 0);
    check(
      'Uncollectible receivables equal order write-offs',
      balances[ACCOUNT.UNCOLLECTIBLE] === writtenOff ? [] : [`journal ${balances[ACCOUNT.UNCOLLECTIBLE]} ≠ orders ${writtenOff}`],
      `account ${ACCOUNT.UNCOLLECTIBLE} = Σ writtenOffMinor = ${writtenOff}`,
    );

    // 15. Each expense account equals the expenses recorded in it (delivery costs also take courier fees),
    //     and cash over/short equals the settlement differences.
    const [expenseRows, settlementRows] = await Promise.all([
      this.expenseModel
        .aggregate<{ _id: string; total: number }>([
          { $match: { status: ExpenseStatus.POSTED } },
          { $group: { _id: '$account', total: { $sum: '$amountMinor' } } },
        ])
        .exec(),
      this.settlementModel
        .aggregate<{ fees: number; difference: number }>([{ $group: { _id: null, fees: { $sum: '$feesMinor' }, difference: { $sum: '$differenceMinor' } } }])
        .exec(),
    ]);
    const expensed = new Map(expenseRows.map((r) => [r._id, r.total]));
    const fees = settlementRows[0]?.fees ?? 0;
    check(
      'Expense accounts equal recorded expenses and courier fees',
      EXPENSE_ACCOUNTS.flatMap((account) => {
        const docs = (expensed.get(account) ?? 0) + (account === ACCOUNT.DELIVERY_COSTS ? fees : 0);
        return balances[account] === docs ? [] : [`account ${account}: journal ${balances[account]} ≠ expenses ${docs}`];
      }),
      'each expense account = Σ posted expenses (+ settlement fees for delivery costs)',
    );
    const shortages = -(settlementRows[0]?.difference ?? 0);
    check(
      'Cash over/short equals settlement differences',
      balances[ACCOUNT.CASH_OVER_SHORT] === shortages ? [] : [`journal ${balances[ACCOUNT.CASH_OVER_SHORT]} ≠ settlements ${shortages}`],
      `account ${ACCOUNT.CASH_OVER_SHORT} = Σ (expected − received) = ${shortages}`,
    );

    // 16. Every cash line says which money account it moved — so the accounts add up to the cash in the books.
    const unassigned = await this.entryModel
      .aggregate<{ entryNumber: number }>([
        { $unwind: '$lines' },
        { $match: { 'lines.account': ACCOUNT.CASH, 'lines.moneyAccount': { $exists: false } } },
        { $project: { entryNumber: 1 } },
      ])
      .exec();
    check(
      'Every cash movement names its money account',
      unassigned.map((e) => `entry #${e.entryNumber}`),
      `Σ money account balances = account ${ACCOUNT.CASH}`,
    );

    // 8. Each coupon's used count equals the live orders holding it.
    const coupons = await this.couponModel.find().select('code usedCount').lean().exec();
    const holders = await this.orderModel
      .aggregate<{ _id: { id?: unknown; code: string }; n: number }>([
        { $match: { coupon: { $exists: true }, status: { $ne: OrderStatus.CANCELLED } } },
        { $group: { _id: { id: '$coupon.id', code: '$coupon.code' }, n: { $sum: 1 } } },
      ])
      .exec();
    check(
      'Coupon use counts match their orders',
      coupons
        .map((c) => {
          const held = holders
            .filter((h) => (h._id.id ? String(h._id.id) === String(c._id) : h._id.code === c.code))
            .reduce((t, h) => t + h.n, 0);
          return held === c.usedCount ? null : `${c.code}: used ${c.usedCount}, held by ${held} orders`;
        })
        .filter((x): x is string => !!x),
      'coupon.usedCount = live orders with that coupon',
    );

    return { ok: checks.every((c) => c.ok), checkedAt: new Date(), checks };
  }
}
