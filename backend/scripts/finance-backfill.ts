/**
 * Prepares one store's existing data for the books, without changing any of it:
 * only fields that are missing are added, so it is safe to run again.
 *
 *   npm run finance:backfill -- <host>            # report what would change
 *   npm run finance:backfill -- <host> --apply    # write it, in one transaction
 *
 * Take a backup first (`mongodump --db <store db>`). What it does:
 *   - orders: amounts in minor units beside the existing pounds, each line's
 *     share of the discount, the coupon's id, `deliveredAt` / `cancelledAt`
 *     from the status history, and a payment status — "not_tracked" for orders
 *     delivered before the books start, which stay as history and are never posted;
 *   - coupons with a per-customer limit: a usage count per customer, from their live orders;
 *   - settings: the date the books start, if not set yet;
 *   - journal lines on cash that predate money accounts: tagged with the main cash box;
 *   - roles "admin" and "super_admin": the payments, finance-reports and refunds permissions
 *     (only super_admin may void a collection or approve a refund).
 * Then it runs the reconciliation checks and prints them.
 */
import { Connection, Types } from 'mongoose';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { withTransaction } from '../src/common/tenant/with-transaction';
import { DEFAULT_CURRENCY } from '../src/common/money/money';
import { orderAmounts } from '../src/finance/order-money';
import { OrderPaymentStatus, OrderStatus } from '../src/orders/enums/order-status.enum';
import { Resource } from '../src/roles/enums/resource.enum';
import { Action } from '../src/roles/enums/action.enum';
import { JournalService } from '../src/finance/journal.service';
import { ReconciliationService } from '../src/finance/reconciliation.service';
import { JournalEntry } from '../src/finance/schemas/journal-entry.schema';
import { Payment } from '../src/finance/schemas/payment.schema';
import { Order } from '../src/orders/schemas/order.schema';
import { Counter } from '../src/orders/schemas/counter.schema';
import { Coupon } from '../src/coupons/schemas/coupon.schema';
import { Setting } from '../src/settings/schemas/setting.schema';
import { MoneyAccount } from '../src/money-accounts/schemas/money-account.schema';
import { Refund } from '../src/refunds/schemas/refund.schema';
import { Product } from '../src/products/schemas/product.schema';
import { StockMovement } from '../src/inventory/schemas/stock-movement.schema';
import { Purchase } from '../src/purchasing/schemas/purchase.schema';
import { Expense } from '../src/expenses/schemas/expense.schema';
import { CourierSettlement } from '../src/couriers/schemas/courier-settlement.schema';

type Doc = Record<string, any>;

// Admins may ask for refunds and pay out approved ones; only the super admin
// approves them (and voids collections), so asking and approving stay apart.
const GRANTS: Record<string, { resource: Resource; actions: Action[] }[]> = {
  super_admin: [
    { resource: Resource.PAYMENTS, actions: [Action.READ, Action.CREATE, Action.APPROVE] },
    { resource: Resource.FINANCE_REPORTS, actions: [Action.READ] },
    { resource: Resource.REFUNDS, actions: [Action.READ, Action.REQUEST, Action.APPROVE, Action.EXECUTE] },
    { resource: Resource.PURCHASES, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
    { resource: Resource.SETTLEMENTS, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.EXECUTE] },
    { resource: Resource.EXPENSES, actions: [Action.READ, Action.CREATE, Action.APPROVE] },
    { resource: Resource.MONEY_ACCOUNTS, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.EXECUTE] },
    { resource: Resource.FINANCE, actions: [Action.EXECUTE] },
  ],
  admin: [
    { resource: Resource.PAYMENTS, actions: [Action.READ, Action.CREATE] },
    { resource: Resource.FINANCE_REPORTS, actions: [Action.READ] },
    { resource: Resource.REFUNDS, actions: [Action.READ, Action.REQUEST, Action.EXECUTE] },
    { resource: Resource.PURCHASES, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
    { resource: Resource.SETTLEMENTS, actions: [Action.READ, Action.CREATE, Action.UPDATE, Action.EXECUTE] },
    { resource: Resource.EXPENSES, actions: [Action.READ, Action.CREATE] },
  ],
};

const lastChange = (order: Doc, status: OrderStatus): Date | undefined =>
  [...(order.statusHistory ?? [])].reverse().find((c: Doc) => c.status === status)?.at;

async function plan(db: Connection) {
  const settings = await db.model('Setting').findOne().lean<Doc>().exec();
  const currencyCode = settings?.currencyCode ?? DEFAULT_CURRENCY;
  const goLiveAt: Date = settings?.finance?.goLiveAt ?? new Date();
  const coupons = await db.model('Coupon').find().lean<Doc[]>().exec();
  const couponByCode = new Map(coupons.map((c) => [c.code, c]));

  const orderUpdates: { _id: Types.ObjectId; number: number; set: Doc }[] = [];
  const problems: string[] = [];

  for (const order of await db.model('Order').find().lean<Doc[]>().exec()) {
    const set: Doc = {};
    if (order.totalMinor === undefined) {
      try {
        const a = orderAmounts(order as never);
        Object.assign(set, {
          subtotalMinor: a.subtotalMinor,
          discountMinor: a.discountMinor,
          shippingFeeMinor: a.shippingFeeMinor,
          taxMinor: a.taxMinor,
          totalMinor: a.totalMinor,
        });
        a.lines.forEach((line, i) => {
          set[`items.${i}.unitPriceMinor`] = line.unitPriceMinor;
          set[`items.${i}.lineTotalMinor`] = line.lineTotalMinor;
          set[`items.${i}.discountMinor`] = line.discountMinor;
        });
      } catch (error) {
        problems.push(`order #${order.orderNumber}: ${(error as Error).message} — left unchanged`);
        continue;
      }
    }
    if (!order.currencyCode) set.currencyCode = currencyCode;
    if (order.coupon && !order.coupon.id && couponByCode.has(order.coupon.code)) {
      set['coupon.id'] = couponByCode.get(order.coupon.code)!._id;
    }
    if (order.status === OrderStatus.DELIVERED && !order.deliveredAt) {
      const at = lastChange(order, OrderStatus.DELIVERED);
      if (at) set.deliveredAt = at;
    }
    if (order.status === OrderStatus.CANCELLED && !order.cancelledAt) {
      const at = lastChange(order, OrderStatus.CANCELLED);
      if (at) set.cancelledAt = at;
    }
    if (!order.bookedAt && order.paymentStatus === undefined) {
      // Delivered before the books: history. Anything still open will be
      // booked normally when it is delivered.
      set.paymentStatus = order.status === OrderStatus.DELIVERED ? OrderPaymentStatus.NOT_TRACKED : OrderPaymentStatus.UNPAID;
    }
    if (order.money === undefined) set.money = { collectedMinor: 0 };
    if (Object.keys(set).length) orderUpdates.push({ _id: order._id, number: order.orderNumber, set });
  }

  // Per-customer coupon counts, from the live orders each customer holds.
  const usages: { coupon: Types.ObjectId; customer: Types.ObjectId; count: number }[] = [];
  for (const coupon of coupons.filter((c) => c.perCustomerLimit != null)) {
    const rows = await db
      .model('Order')
      .aggregate([
        { $match: { 'coupon.code': coupon.code, status: { $ne: OrderStatus.CANCELLED } } },
        { $group: { _id: '$customer', count: { $sum: 1 } } },
      ])
      .exec();
    for (const row of rows) usages.push({ coupon: coupon._id, customer: row._id, count: row.count });
  }

  const roles = await db.model('Role').find({ name: { $in: Object.keys(GRANTS) } }).lean<Doc[]>().exec();
  const roleGrants = roles.flatMap((role) =>
    GRANTS[role.name]
      .filter((g) => !role.permissions.some((p: Doc) => p.resource === g.resource))
      .map((g) => ({ roleId: role._id, role: role.name, grant: g })),
  );

  // Cash moved before money accounts existed went through the main cash box;
  // say so on those lines (only the missing tag is added — no amount changes).
  const untaggedCash = await db
    .model('JournalEntry')
    .countDocuments({ lines: { $elemMatch: { account: '1000', moneyAccount: { $exists: false } } } })
    .exec();

  return { settings, goLiveAt, setGoLive: !settings?.finance?.goLiveAt, orderUpdates, usages, roleGrants, problems, untaggedCash };
}

function journalFor(db: Connection) {
  return new JournalService(
    db.model<JournalEntry>(JournalEntry.name),
    db.model<Counter>(Counter.name),
    db.model<Setting>(Setting.name),
    db.model<MoneyAccount>(MoneyAccount.name),
  );
}

async function main() {
  const [host, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run finance:backfill -- <host> [--apply]');
  const apply = flag === '--apply';

  const tenants = new TenantConnectionService();
  const db = await tenants.getConnection(host);
  const p = await plan(db);

  console.log(`Store ${host} — ${apply ? 'APPLYING' : 'dry run (add --apply to write)'}`);
  console.log(`  books start: ${p.goLiveAt.toISOString()}${p.setGoLive ? ' (will be set now)' : ' (already set)'}`);
  console.log(`  orders to complete: ${p.orderUpdates.length}`);
  for (const u of p.orderUpdates) console.log(`    #${u.number}: ${Object.keys(u.set).filter((k) => !k.startsWith('items.')).join(', ')}`);
  console.log(`  coupon usage counts: ${p.usages.length}`);
  for (const g of p.roleGrants) console.log(`  role ${g.role}: + ${g.grant.resource} [${g.grant.actions.join(', ')}]`);
  if (p.untaggedCash) console.log(`  cash entries to tag with the main cash box: ${p.untaggedCash}`);
  for (const problem of p.problems) console.log(`  ! ${problem}`);

  if (apply) {
    await withTransaction(db, async (session) => {
      if (p.setGoLive) {
        if (p.settings) {
          await db.model('Setting').updateOne({ _id: p.settings._id, 'finance.goLiveAt': { $exists: false } }, { $set: { 'finance.goLiveAt': p.goLiveAt } }, { session }).exec();
        } else {
          await db.model('Setting').create([{ finance: { goLiveAt: p.goLiveAt } }], { session });
        }
      }
      for (const u of p.orderUpdates) {
        await db.model('Order').collection.updateOne({ _id: u._id }, { $set: u.set }, { session });
      }
      for (const usage of p.usages) {
        await db
          .model('CouponUsage')
          .updateOne({ coupon: usage.coupon, customer: usage.customer }, { $setOnInsert: { count: usage.count } }, { upsert: true, session })
          .exec();
      }
      if (p.untaggedCash) {
        const cash = await journalFor(db).defaultMoneyAccount(session);
        await db
          .model('JournalEntry')
          .collection.updateMany(
            { lines: { $elemMatch: { account: '1000', moneyAccount: { $exists: false } } } },
            { $set: { 'lines.$[cash].moneyAccount': cash } },
            { arrayFilters: [{ 'cash.account': '1000', 'cash.moneyAccount': { $exists: false } }], session },
          );
      }
      for (const g of p.roleGrants) {
        await db
          .model('Role')
          .updateOne({ _id: g.roleId, 'permissions.resource': { $ne: g.grant.resource } }, { $push: { permissions: g.grant } }, { session })
          .exec();
      }
    });
    console.log('  written.');
  }

  const journal = journalFor(db);
  const report = await new ReconciliationService(
    db.model<JournalEntry>(JournalEntry.name),
    db.model<Order>(Order.name),
    db.model<Payment>(Payment.name),
    db.model<Coupon>(Coupon.name),
    db.model<Refund>(Refund.name),
    db.model<Product>(Product.name),
    db.model<StockMovement>(StockMovement.name),
    db.model<Purchase>(Purchase.name),
    db.model<Expense>(Expense.name),
    db.model<CourierSettlement>(CourierSettlement.name),
    journal,
  ).run();
  console.log(`Reconciliation: ${report.ok ? 'all checks pass' : 'BREAKS FOUND'}`);
  for (const c of report.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : ` — ${c.offenders.join('; ')}`}`);

  await db.close();
  if (!report.ok && apply) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
