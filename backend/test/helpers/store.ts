import { Connection, Types } from 'mongoose';
import { OrdersService } from '../../src/orders/orders.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { CouponsService } from '../../src/coupons/coupons.service';
import { JournalService } from '../../src/finance/journal.service';
import { PaymentsService } from '../../src/finance/payments.service';
import { FinanceReportsService } from '../../src/finance/finance-reports.service';
import { ReconciliationService } from '../../src/finance/reconciliation.service';
import { ReportsService } from '../../src/reports/reports.service';
import { RefundsService } from '../../src/refunds/refunds.service';
import { PurchasingService } from '../../src/purchasing/purchasing.service';
import { CouriersService } from '../../src/couriers/couriers.service';
import { ExpensesService } from '../../src/expenses/expenses.service';
import { StatementsService } from '../../src/finance/statements.service';
import { PeriodsService } from '../../src/finance/periods.service';
import { MoneyAccountsService } from '../../src/money-accounts/money-accounts.service';
import { OrderStatus } from '../../src/orders/enums/order-status.enum';
import { CouponType } from '../../src/coupons/schemas/coupon.schema';
import { parseMoney } from '../../src/common/money/money';

/**
 * One store wired the way Nest wires it, on its own database: real orders,
 * stock, coupons, journal, payments and reports. Only what reaches outside
 * the database (delivery pricing, the customer address book, email) is
 * stubbed, with fixed answers.
 */
export function buildStore(db: Connection) {
  const model = (name: string) => db.model(name) as never;
  const zone = new Types.ObjectId();
  const subZone = new Types.ObjectId();
  const delivery = { price: 45 };

  const priceList = {
    resolve: async () => ({
      zone,
      subZone,
      zoneName: { en: 'Cairo', ar: 'القاهرة' },
      subZoneName: { en: 'Nasr City', ar: 'مدينة نصر' },
      price: delivery.price,
    }),
  };
  const customers = {
    getProfile: async (id: string) => db.model('Customer').findById(id).exec(),
    getAddress: async () => ({ fullName: 'Mona Adel', phone: '01001234567', street: '1 Tahrir St', subZone }),
    clearSavedCart: async () => undefined,
  };
  const notifications = { orderPlaced: () => undefined, statusChanged: () => undefined };

  const journal = new JournalService(model('JournalEntry'), model('Counter'), model('Setting'), model('MoneyAccount'));
  const inventory = new InventoryService(model('Product'), model('StockMovement'), db, journal);
  
  const coupons = new CouponsService(model('Coupon'), model('Order'), model('CouponUsage'));
  const orders = new OrdersService(
    model('Order'),
    model('Counter'),
    model('Product'),
    model('Setting'),
    db,
    journal,
    inventory,
    customers as never,
    {} as never,
    coupons,
    priceList as never,
    notifications as never,
  );
  const payments = new PaymentsService(
    model('Payment'),
    model('Order'),
    model('Counter'),
    model('JournalEntry'),
    model('Refund'),
    model('Courier'),
    db,
    journal,
  );
  const finance = new FinanceReportsService(model('JournalEntry'), model('Order'), model('Setting'), journal);
  const reconciliation = new ReconciliationService(
    model('JournalEntry'),
    model('Order'),
    model('Payment'),
    model('Coupon'),
    model('Refund'),
    model('Product'),
    model('StockMovement'),
    model('Purchase'),
    model('Expense'),
    model('CourierSettlement'),
    journal,
  );
  const dashboard = new ReportsService(model('Order'), model('Customer'), model('Review'), finance);
  const purchasing = new PurchasingService(
    model('Supplier'),
    model('Purchase'),
    model('PurchaseReturn'),
    model('SupplierPayment'),
    model('Product'),
    model('Counter'),
    db,
    inventory,
    journal,
  );
  const couriers = new CouriersService(model('Courier'), model('CourierSettlement'), model('Payment'), model('Refund'), model('Counter'), db, journal);
  const expenses = new ExpensesService(model('Expense'), model('Order'), model('Counter'), model('Setting'), db, journal);
  const statements = new StatementsService(model('JournalEntry'), model('Order'), model('Purchase'), model('Refund'), model('MoneyAccount'), finance, journal);
  const periods = new PeriodsService(model('Setting'), model('User'), reconciliation, finance);
  const moneyAccounts = new MoneyAccountsService(model('MoneyAccount'), model('MoneyTransfer'), model('JournalEntry'), model('Counter'), db, journal);
  const refunds = new RefundsService(
    model('Refund'),
    model('Order'),
    model('ReturnRequest'),
    model('Counter'),
    model('Setting'),
    model('Customer'),
    model('User'),
    model('Courier'),
    db,
    journal,
    inventory,
    { statusChanged: () => undefined } as never,
  );

  let n = 0;
  const helpers = {
    /**
     * A product with stock on the shelf at `price` pounds. With `unitCost`
     * the stock carries that cost per unit; without, it has none yet (stock
     * from before the books).
     */
    product: async (price: number, stock = 100, unitCost?: number) => {
      const id = String(
        (
          await db.model('Product').create({
            name: { en: `Product ${++n}` },
            category: new Types.ObjectId(),
            slug: `product-${n}-${new Types.ObjectId()}`,
            price,
            stock,
          })
        )._id,
      );
      // Costed the way a store does it, so the books and the ledger know.
      if (unitCost !== undefined) await inventory.setOpeningCost(id, undefined, parseMoney(unitCost));
      return id;
    },
    customer: async () =>
      String((await db.model('Customer').create({ name: `Customer ${++n}`, email: `c${n}-${new Types.ObjectId()}@x.test`, isActive: true }))._id),
    coupon: async (fields: { code: string; type?: CouponType; value: number; perCustomerLimit?: number; usageLimit?: number }) =>
      db.model('Coupon').create({ type: CouponType.PERCENTAGE, ...fields }),
    place: (customerId: string, items: { productId: string; quantity: number }[], couponCode?: string) =>
      orders.create(customerId, { items, addressId: String(new Types.ObjectId()), couponCode } as never, 'shop.test'),
    /** Takes an order through confirmed and shipped to `to`. */
    advance: async (orderId: string, to: OrderStatus.DELIVERED | OrderStatus.SHIPPED = OrderStatus.DELIVERED) => {
      for (const status of [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]) {
        await orders.updateStatus(orderId, status, undefined, undefined, 'shop.test');
        if (status === to) break;
      }
      return db.model('Order').findById(orderId).lean().exec() as Promise<any>;
    },
  };

  return { db, delivery, journal, inventory, coupons, orders, payments, finance, reconciliation, dashboard, refunds, purchasing, couriers, expenses, statements, periods, moneyAccounts, ...helpers };
}

export type Store = ReturnType<typeof buildStore>;
