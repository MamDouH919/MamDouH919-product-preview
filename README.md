# Gravity — Multi-Tenant E-Commerce Starter

A sample **multi-tenant e-commerce platform**: one codebase that serves several storefronts, each with its own host, database, branding, and content — plus a bilingual (EN/AR) admin dashboard to manage them.

Built as a NestJS + MongoDB API and a Next.js 16 (App Router) frontend.

```
mahmoud-feda/
├── backend/    NestJS 11 · MongoDB (Mongoose) · JWT auth · REST + Swagger
└── frontend/   Next.js 16 · React 19 · MUI 7 · Redux Toolkit · React Query · i18next
```

---

## Features

**Storefront (public)**
- Home page composed of a banner slider, categories slider and products grid
- Category and sub-category browsing, product listing and product detail pages (`/products/[slug]`, `/categories/[slug]`)
- Product search (English and Arabic, partial words), price range, in-stock filter and sorting — all kept in the URL, so a filtered view can be shared
- Wishlist (`/account/wishlist`) with a heart on every product card
- Newsletter sign-up in the footer
- Bilingual content (English / Arabic) with full RTL support
- Per-tenant branding: logo, favicon, colors, currency, contact info and social links
- Floating WhatsApp button wired to the tenant's `settings`
- Customer accounts (`/[locale]/account`): register, sign in, profile, password reset and a saved address book
- Cart (`/cart`) with coupon codes, checkout (`/checkout`) with cash on delivery, and order history with self-service cancellation (`/account/orders`)
- Order emails to the customer (placed, confirmed, shipped, delivered, cancelled) and a new-order alert to the store

**Admin dashboard (`/[locale]/admin`)**
- CRUD for products (with variants, tags, multiple images), categories, sub-categories, banners and content sections
- Site settings: title, description, logo, favicon, phone/WhatsApp/email/address, social media, primary color, currency
- Drag-and-drop ordering (`@dnd-kit`) and rich text editing (TipTap)
- Stock tracking with an append-only movement ledger, low-stock flags and stock takes
- Orders: list with status filter and search, order detail, status changes (confirm → ship → deliver, or cancel) with an audit trail
- Coupons: percentage or fixed, minimum order, cap, start/end dates, total and per-customer limits
- Newsletter subscribers list with CSV export
- Customer directory with the ability to block an account without losing its history
- Database export / import of one store as Extended JSON (super-admin only; see Notes)
- Role-based permissions per resource and action

**Platform**
- Host-based multi-tenancy: one process, one database per tenant, resolved per request
- `npm run add-tenant` — interactive CLI that registers a host and seeds its database
- JWT access + refresh tokens, forgot/reset password over email (Nodemailer), OTP support
- Image upload with automatic compression and format normalization (`sharp`), stored per tenant
- Swagger API docs at `/api` (disabled when `NODE_ENV=production`)

---

## Tech Stack

| Layer | Stack |
|---|---|
| API | NestJS 11, Mongoose 9, JWT, class-validator, Multer + sharp, Nodemailer, Swagger |
| Web | Next.js 16, React 19, TypeScript, MUI 7 (+ Emotion, stylis-plugin-rtl), Tailwind 4 |
| State / data | Redux Toolkit, TanStack Query + Table, React Hook Form, axios |
| i18n | i18next / react-i18next, locale-prefixed routes (`/[locale]/…`) |
| Editor / UI | TipTap, framer-motion, dnd-kit, sonner, lucide-react |

---

## Multi-Tenancy

Tenants are identified by **host**. Each host gets its own MongoDB database, its own frontend URL, and its own upload directory. The tenant map is one entry per host:

```jsonc
// backend/src/config.json  (git-ignored — development)
{
  "localhost":      { "mongoUri": "mongodb://127.0.0.1:27017/demo",    "frontendUrl": "http://localhost:3000" },
  "demo.localhost": { "mongoUri": "mongodb://127.0.0.1:27017/demo-db", "frontendUrl": "http://demo.localhost:3000" }
}
```

Each store needs its own database: the API refuses to start if two hosts share one. A second name for the same store (`www.` plus the bare domain) is declared with `"aliasOf": "<primary host>"` on the second entry, so background jobs still visit that store once.

In production, put the same JSON in the `TENANT_MAP` env var instead — it takes precedence over the file, so connection strings with credentials never reach source control. If neither exists the app still boots; it just logs a warning and every request 404s until a tenant is registered.

### How a request is routed

1. `TenantMiddleware` (`common/middleware/tenant.middleware.ts`) runs on every route and stashes `req.hostname` as `req.tenant`.
2. The request-scoped `TENANT_CONNECTION` provider (`common/tenant/tenant.module.ts`, `@Global`) asks `TenantConnectionService` for that host's Mongoose connection.
3. `TenantConnectionService` (`common/helpers/dynamic-connection.ts`) looks the host up in the tenant map — an unknown host throws `404 Unknown tenant`, and the lookup uses an own-property check so a hostile `Host: __proto__` can't resolve to anything. Connections are opened once and cached per host.
4. When a connection is opened, **every** schema in `common/tenant/tenant-schemas.ts` is registered on it, so cross-model `.populate()` always finds its target on the same connection.
5. `tenantModelProvider(name, schema)` registers each model under the same token `@InjectModel(name)` uses — so services and controllers are ordinary Nest code with no tenant awareness at all. Every feature module uses it in place of `MongooseModule.forFeature`.

Uploads are written per tenant by `tenantImageStorage` (`common/helpers/upload-storage.ts`), which sanitizes the host into a filesystem-safe folder name so a crafted `Host` header cannot traverse out of `uploads/`:

```
backend/uploads/
├── localhost/        { settings, banners, categories, products, sections, … }
└── demo.localhost/   { settings, banners, categories, products, sections, … }
```

Because every tenant has a separate database, tenant data is isolated by construction — no `tenantId` column and no risk of a missing `where` clause leaking one store's products into another. Per-tenant `frontendUrl` is also what password-reset emails link to, so a reset requested on one storefront can never point at another.

On the frontend, `frontend/config.json` holds per-deployment app config (languages, default language, RTL languages, theme color), and the `tenant` Redux slice (`frontend/Store/slices/tenant.ts`) carries the active tenant's logo and currency into the UI. Visual identity beyond that — site title, favicon, primary color, contact details — lives in the `settings` collection, so it is per-tenant data rather than code.

### Adding a tenant

```bash
cd backend
npm run add-tenant
```

The CLI asks for the hostname (no port), a Mongo URI (or builds a local one from a database name), and the frontend origin. It writes the entry into `src/config.json`, prints the equivalent `TENANT_MAP` line for production, and offers to seed the new database with roles plus admin / super-admin users right away.

---

## Data Model

All user-facing text uses a shared `LocalizedField` (`{ en, ar }`), so a single document carries both languages.

| Collection | Notable fields |
|---|---|
| `Product` | `name`, `description`, `shortDescription`, `images[]`, `price`, `sku`, `category`, `subCategory`, `slug`, `tags[]`, `variants[{ _id, label, price, sku, stock }]`, `isActive`, `order`, `trackStock`, `stock`, `lowStockThreshold`, `allowBackorder` |
| `StockMovement` | `product`, `variantId?`, `variantLabel?`, `type`, `quantity` (signed), `balanceAfter`, `reason`, `reference`, `user` |
| `Customer` | `name`, `email`, `password` (bcrypt), `phone`, `isVerified`, `isActive`, `addresses[{ _id, label, fullName, phone, city, area, street, building, notes, isDefault }]`, `wishlist[]` (product ids) |
| `Category` | `name`, `description`, `image`, `slug`, `isActive`, `order` |
| `SubCategory` | belongs to a category, same shape |
| `Banner` | `image`, `title`, `description`, `active`, `weight` |
| `Section` | `sectionName`, `title`, `description`, `image`, `type` (`DEFAULT` / `HIGHLIGHTS` / `GALLERY` / `LINKS`), `highlights[]`, `gallery[]`, `links[]` |
| `Setting` | site title/description, logo, favicon, phone, whatsapp, landline, email, address, `socialMedia[]`, `primaryColor`, `currency` |
| `User` | `name`, `email`, `password` (bcrypt), `isVerified`, `roleId`, `isSuper` |
| `Role` | `name`, `permissions[{ resource, actions }]` |
| `Subscribe` | newsletter signups (`email` required and de-duplicated; names optional) |
| `Coupon` | `code` (upper-case, unique), `type` (`percentage` / `fixed`), `value`, `minSubtotal`, `maxDiscount`, `startsAt`, `expiresAt`, `usageLimit`, `perCustomerLimit`, `usedCount`, `isActive` |
| `Order` | `orderNumber`, `customer`, `items[{ product, variantId, name, variantLabel, sku, image, unitPrice, quantity, lineTotal, stockDeducted }]`, `shippingAddress`, `subtotal`, `discount`, `coupon{ code, type, value }`, `shippingFee`, `total`, `currency`, `paymentMethod`, `status`, `statusHistory[]`, `notes`, `locale` |

`Setting` also carries `shippingFee` — a flat delivery charge added to every order.

Supporting collections: `RefreshToken`, `ResetToken`, `Otp`, `CustomerRefreshToken`, `CustomerResetToken`, `Counter` (per-tenant order number sequence).

---

## Inventory

Stock lives in one of two places depending on the product:

- **No variants** → the product's own `stock` field.
- **Has variants** → each variant's `stock`. The product's `totalStock` virtual sums them.

`trackStock: false` opts a product out entirely — it is never out of stock and orders never check it. `allowBackorder: true` keeps tracking but lets the count go negative instead of rejecting the sale.

### The ledger is the source of truth

Every change is written to `StockMovement` — an append-only log of what happened, when, why, and who did it. The `stock` number on the product is a running total of those rows, never a figure typed in by hand. Nothing in the ledger is ever edited or deleted; a mistake is corrected by writing an opposing `adjustment`.

This has two consequences worth knowing about:

1. **`InventoryService` is the only thing allowed to change stock.** `PATCH /products/:id` strips the product-level `stock` field and re-attaches each existing variant's real stock before saving, because the edit form's copy was read when the page opened and is stale by definition. Only brand-new variants may declare an opening quantity, and even that lands as an `opening` movement.
2. **Creating a product saves it at zero and fills it through the ledger**, so the stored count always reconciles against its movements.

Movement types and their direction: `opening`, `purchase`, `return`, `order_cancelled`, `adjustment_in` add stock; `sale`, `damage`, `purchase_return`, `adjustment_out` remove it; `cost_set` moves only value. By hand an admin may record only `damage` and the two adjustments — everything else is written by the event that caused it (a checkout, a refund, a purchase), because each also moves money.

### Cost

Each product (or variant) keeps the value of its stock next to its quantity — `inventoryValueMinor`, moving weighted average, updated in the same write as `stock` — and every movement records the value it moved (`valueMinor`, net, and `valueAfterMinor`). Units out cost round_half_up(value × q ÷ Q); the last units out take exactly what is left, so the value drains to zero with the stock. Goods coming back (a cancelled order, a restocked refund) return at the cost they left at; goods sent back to a supplier leave at what they were bought for. Units sold short (`allowBackorder`) are costed at the last unit cost and marked estimated; when stock arrives, the difference is booked to cost of goods sold as variance.

Stock from before the books has no cost (`inventoryValueMinor` unset): its sales are reported as uncosted, and a purchase is refused until an admin sets what it cost (`POST /inventory/opening-cost`, booked as opening inventory against equity). Inventory → "Set cost" does it from the dashboard.

### Overselling

Stock is applied with a conditional `$inc` — `{ stock: { $gte: quantity } }` for products, an `$elemMatch` guard plus `arrayFilters` for variants. Two concurrent sales of the last unit cannot both succeed; the loser gets `400 Not enough stock: N available, M requested`. `bulk-adjust` runs as one transaction: every item lands or none does, and a refused batch leaves no ledger rows behind.

### Stock takes

`POST /inventory/stock-take` takes what was physically counted and works out the delta itself, writing it as an `adjustment`. The admin never has to compute a difference.

### Migrating existing data

Variants used to be stored with `_id: false`, so products created before this feature have variants with no id for movements to reference:

```bash
cd backend
npm run migrate:inventory -- localhost   # per tenant; safe to re-run
npm run seed -- localhost                # grants the new `inventory` permission
```

## Orders

Checkout requires a customer account; browsing and filling a cart do not. The cart lives in the browser (`localStorage`, which is per host and therefore per tenant) and holds only *what* and *how many* — every price shown in the cart and every price charged comes from the server.

### Pricing

`POST /orders/quote` prices a basket against the live catalogue and reports, per line, why it can't be bought if it can't: `unavailable` (deleted, hidden, or a variant that no longer exists), `no_price`, or `insufficient_stock` (with how many are available). The cart page calls it on every change; placing an order runs the same check. The order DTO has no price field, and the global `forbidNonWhitelisted` pipe rejects one if sent.

### Placing an order

1. Customer must be active (blocking an account stops new orders even with a live token) and the address must be one of theirs.
2. Lines are re-priced; any issue rejects the order with the problem lines.
3. In one transaction: the order number is taken, the order is written as `pending` with a snapshot of names, prices and the shipping address (later catalogue edits never rewrite a receipt), the coupon use is claimed, and stock is taken as `sale` movements referencing `Order #N`. If a concurrent checkout got the last unit or the last coupon use, nothing commits — no order, no movement, no burnt order number — and the customer gets `409` and is sent back to the cart.

Order numbers come from a `Counter` document incremented inside that transaction, starting at 1001 per tenant. Every amount is stored twice: in minor units (`subtotalMinor`, `totalMinor`, per line `unitPriceMinor`, `lineTotalMinor` and the line's `discountMinor` share), which is what the books use, and in pounds (`subtotal`, `total`, …) for screens and emails.

### Coupons

The cart sends the code with `POST /orders/quote`; the reply carries `discount` and `coupon`, or a `couponError` (`not_found`, `not_started`, `expired`, `usage_limit`, `customer_limit`, `min_subtotal`) that leaves the rest of the quote valid. There is deliberately no public endpoint for looking a code up.

Placing the order re-checks the code with the customer known (so per-customer limits apply), then claims a use inside the checkout transaction: a conditional `$inc` on `usedCount`, and for per-customer limits a conditional `$inc` on that customer's `CouponUsage` document — two checkouts racing for the last use, even by the same customer, can't both get it. If stock then fails, the transaction takes the use back with it. A percentage is rounded half up to the piastre and split across the lines by value so the shares add up exactly. Cancelling an order gives its use back too, and cancelled orders don't count toward a customer's limit. Orders keep their own copy of the coupon, so editing or deleting one never rewrites a past order.

### Emails

Sent in the language the customer checked out in (`locale`), with links built from the tenant's `frontendUrl`:

- **Customer:** order received, then each status change (a note such as a tracking number is included).
- **Store:** every new order, and orders the customer cancels. Sent to the `email` in Settings, or the sending mailbox if that's empty.

Sending is fire-and-forget: a mail failure is logged and never fails or delays checkout. Everything a customer typed is HTML-escaped (`common/helpers/escape-html.ts`).

### Status

```
pending ──► confirmed ──► shipped ──► delivered
   │            │            │
   └────────────┴────────────┴──► cancelled
```

Transitions outside this graph are refused (`ORDER_TRANSITIONS`). Each change is a conditional update on the status that was read, inside a transaction with everything it implies, so two admins acting at once can't both succeed. **Delivering books the sale** (see Finance). **Cancelling returns stock** as `order_cancelled` movements, only for lines that actually deducted it, and gives the coupon use back. Restocking is best-effort per line: a product that stopped tracking stock since the sale is logged and skipped rather than blocking the cancellation.

Existing tenants need their admin roles re-seeded to get the `orders` and `coupons` permissions: `npm run seed -- <host>`.

## Finance

Each store keeps its own books (`journalentries`), written only by business events in the same transaction as the event, and never edited: a mistake is undone by a reversing entry. Amounts are integer minor units. The chart of accounts is fixed (`finance/accounts.ts`).

| Event | Posts |
|---|---|
| Order placed | nothing — a pending order is not a sale |
| Order delivered | Dr receivables (total), Dr sales discounts (discount) / Cr product sales (subtotal), Cr delivery income (fee) |
| Cash collected (`POST /finance/orders/:id/collections`) | Dr cash, or Dr courier cash when a courier holds it / Cr receivables |
| Collection voided (`POST /finance/payments/:id/void`, needs `payments:approve`) | the mirror image of the collection, dated now |
| Refund paid out (`POST /finance/refunds/:id/execute`) | Dr sales returns (product part), Dr delivery-fee refunds (fee part) / Cr cash, courier cash, or receivables for a credit |
| Refund reversed (`POST /finance/refunds/:id/reverse`) | the mirror image of the payout, dated now |
| Order placed (costed stock) | Dr goods awaiting delivery / Cr inventory, at the cost the units left at |
| Order delivered (costed stock) | also Dr cost of goods sold / Cr goods awaiting delivery |
| Order cancelled | Dr inventory / Cr goods awaiting delivery, at that same cost |
| Restocked refund | Dr inventory / Cr cost of goods sold, at the line's share of its cost |
| Purchase posted (`POST /finance/purchases/:id/post`) | Dr inventory (lines + freight split by value) / Cr supplier payables |
| Goods back to supplier (`POST /finance/purchase-returns`) | Dr supplier payables / Cr inventory, at purchase cost |
| Supplier paid (`POST /finance/supplier-payments`) | Dr supplier payables / Cr cash — oldest purchases settled first, never more than owed |
| Damage, stock-take differences | Dr/Cr inventory losses / Cr/Dr inventory, at average cost |
| Courier settles (`POST /finance/settlements`) | Dr cash (handed over), Dr delivery costs (their fee), Dr/Cr cash over/short (difference, reason required) / Cr courier cash (all they held) |
| Expense (`POST /finance/expenses`) | Dr the category (6000 delivery, 6100–6700 operating) / Cr cash; reversed, never edited (`expenses:approve`) |
| Balance written off (`POST /finance/orders/:id/write-off`, `payments:approve`) | Dr uncollectible receivables / Cr receivables, never more than is owed |
| Money moved between accounts (`POST /finance/money-accounts/transfers`) | Dr cash (to account) / Cr cash (from account), never more than the source holds |

An order's **status** (pending → delivered) and its **payment status** (unpaid → partially paid → paid) are separate: delivered is not paid. A collection is only accepted for a delivered order and never for more than is still owed. Orders delivered before a store's books started (`settings.finance.goLiveAt`) are history: marked `not_tracked`, never posted.

Report figures come from the journal, by the date each event happened, in the store's time zone (Settings → `timezone`): **net revenue** = product sales − discounts − returns + delivery income, for orders *delivered* in the period. Orders *placed* are shown apart, as pipeline. Cost of sales is cost of goods sold plus inventory losses; gross profit is net revenue less that; contribution is gross profit less delivery costs; net profit is contribution less operating expenses (6100–6900, write-offs and cash differences included). Net cash flow is everything in and out of the cash account in the period. `uncostedLines` counts delivered lines whose stock had no cost — while it is above zero, gross profit is overstated by their missing cost. `GET /finance/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` gives the period's figures and the receivables and courier cash at its end; `GET /finance/reconciliation` recomputes each balance from the orders and payments and names anything that disagrees. Both need `finance-reports:read`, as does the dashboard.

### Money accounts

Every line on the cash account names a money account (`moneyaccounts`): a cash box, bank account or wallet. A store starts with one, "Cash", created as its default the first time money moves; anything that doesn't pick an account uses the default, so a store with one account never sees a picker. With more than one, collections kept by the store, cash refunds, courier settlements, expenses and supplier payments each choose one (`moneyAccountId`). An account's balance is the sum of its cash lines — never a stored number. Only one account is the default (a unique partial index, `one_default`); the default can't be deactivated, and an account still holding money can't either. `GET /finance/money-accounts` (`payments:read`) lists them with balances; creating, renaming, switching the default and transfers need the `money-accounts` resource.

### Statements and closing

`GET /finance/reports/…` (`finance-reports:read`), each also as a spreadsheet with `?format=csv&lang=en|ar`:

| Report | Range | What it is |
|---|---|---|
| `profit-and-loss` | `from`, `to` | revenue, cost of sales and expense accounts for the days, with the same number of days just before for comparison |
| `cash-flow` | `from`, `to` | direct method: cash in and out by cause (expenses by category), opening and closing balance of each money account; transfers net to zero |
| `receivables` | now | what each delivered order still owes, aged from delivery (0–7, 8–30, 31–60, over 60 days) |
| `payables` | now | what each posted purchase still owes, aged from receipt, with days past due |
| `trial-balance` | `to` | every account's debits, credits and balance through the end of that day; total debits must equal total credits |
| `sales-by-product` | `from`, `to` | units delivered, net sales after each line's share of the discount, cost, margin, and refunds made in the period |

`GET /inventory/valuation` (`finance-reports:read`) values stock on hand at its moving average cost and lists items without a cost. Days are calendar days in the store's time zone; ranges are `[start of from, start of the day after to)`. Receivables and payables are as of now: they can't yet be run for a past date.

The store's super admin can close the books through a past day (`POST /finance/periods/lock {through}`): nothing can then be posted dated on or before it. Closing only moves forward, never covers today, and is refused unless every reconciliation check passes. `POST /finance/periods/reopen {through?, reason}` moves the closing back (or removes it), with a reason. Both need the `finance` resource and are checked against the user's own `isSuper`; every change is kept in `settings.finance.history`. The admin pages are `/admin/reports`, `/admin/money-accounts` and `/admin/books` (reconciliation and closing).

### Couriers

A collection held by a courier names the courier (`courierId`), and so does a refund they pay out (`courier_cash`). What a courier holds is their unsettled collections less those refunds. A settlement takes all of it at once: their fee is a delivery cost, and anything that doesn't match what they hand over goes to cash over/short with its reason. Settled collections and refunds can no longer be voided or reversed.

### Refunds

A refund is its own record (`refunds`, numbered from 3001): requested → approved → executed, or rejected; an executed one can only be reversed. Only execution moves money, dated the day it happens, so the refund reports in its own period and the sale stays in its own. A refund names its order lines (and the return, when goods came back), a product part split across the lines, a delivery-fee part, a method (`cash`, `courier_cash`, `credit_against_receivable`) and a reason.

Caps, checked on request (counting refunds still open) and again inside the payout transaction (counting paid ones): each line ≤ what was paid for it (its total less its share of the discount; the last units back take exactly what remains); delivery ≤ the fee left; total ≤ the order total left; cash ≤ what was collected and not yet refunded; a credit ≤ what is still owed. Two payouts racing for the same order write the same order document, so only one commits.

Rules, per store, changed only by its super admin (`PATCH /finance/refund-rules`, every change kept with its old and new value): refunds up to `autoApproveUpTo` (default 200.00) are approved as they are asked for; above `singleApproverUpTo` (default 2,000.00) the approver must not be the requester; the delivery fee goes back per `deliveryFeeRefund` (default: only when everything comes back and it was the store's fault). Anything beyond that policy needs an approver and a note. Permissions are separate from orders: `refunds:request`, `refunds:approve`, `refunds:execute`, `refunds:read`. Returns now only accept or reject goods; refunding one is `POST /finance/refunds` with its `returnId`, and paying that out marks the return refunded and emails the customer.

Existing stores: back up, then `npm run finance:backfill -- <host>` (dry run) and `-- <host> --apply`. It adds minor-unit amounts, delivery dates and payment status to existing orders without changing any existing field, starts the books, grants the `payments`, `finance-reports`, `refunds`, `purchases`, `settlements` and `expenses` permissions to the `admin` and `super_admin` roles, plus `money-accounts` and `finance` (closing periods) to `super_admin` only, tags cash lines that name no money account with the default (only `super_admin` may void a collection or approve a refund; `admin` may ask for and pay out approved ones), and prints the reconciliation.

Customers may cancel their own order only while it is `pending`; after the store confirms it, cancellation is an admin action. Every change is appended to `statusHistory` with the admin who made it and an optional note (e.g. a tracking number).

## Customer Accounts

Storefront customers are a **separate identity from admin users**, not a role on the same one.

`User` carries `roleId` and `isSuper`, and `AuthorizationGuard` decides dashboard access by reading permissions off that role. If customers lived in the same collection, "can this account reach the dashboard?" would depend on a role document being configured correctly. Keeping them apart makes the answer structural.

The separation runs all the way down:

| | Admin | Customer |
|---|---|---|
| Collection | `User` | `Customer` |
| Auth routes | `/auth/*` | `/customer-auth/*` |
| Guard | `AuthenticationGuard` | `CustomerAuthGuard` |
| JWT claims | `{ userId, tenant }` | `{ customerId, tenant, type: 'customer' }` |
| Refresh / reset tokens | `RefreshToken`, `ResetToken` | `CustomerRefreshToken`, `CustomerResetToken` |
| Cookie | `token` | `customer_token` |
| Axios instance | `lib/api.ts` | `lib/customerApi.ts` |

Three details are load-bearing:

1. **`AuthenticationGuard` rejects any token carrying `type: 'customer'`.** Both token kinds are signed with the same secret, so without that check a customer token would pass signature verification on admin routes and be judged only by whatever role lookup came next.
2. **Refresh tokens live in separate collections.** `POST /auth/refresh` looks a token up by its string alone and mints an admin access token for whatever id it finds — a customer token in that collection would be redeemable for admin access.
3. **Self-service routes take no id.** Everything under `/customers/me` acts on the customer in the token, so one customer cannot address another's profile or addresses. Passing someone else's address id returns `404`, not their data.

### Addresses

Addresses are embedded in the customer document — they are only ever read through their owner, and an order copies the address it shipped to rather than referencing it, so nothing outside the document points at them.

The first address a customer saves becomes their default whether or not they asked, since checkout needs something to preselect. Promoting one clears the rest, and deleting the default promotes another, so a customer with addresses always has exactly one default.

Email is not editable from the profile — it is the sign-in identity and changing it needs a verification round-trip that does not exist yet. Registration signs the customer straight in; email verification is not required to place an order.

### Route guards

`proxy.ts` reads the two cookies independently: `/admin` needs `token`, `/account` needs `customer_token`, and neither substitutes for the other. A customer session opening `/admin` is sent to the dashboard login; a guest opening `/account` is sent to `/account/login?from=…` and returned there afterwards. Pages under `/account/login`, `/register`, `/forgot-password` and `/reset-password` stay open to guests.

---

## Authorization

Two guards run in sequence:

- `AuthenticationGuard` — verifies the JWT `Bearer` token and attaches `userId` to the request.
- `AuthorizationGuard` — reads the `@Permissions([{ resource, actions }])` decorator on the route and checks it against the user's role.

Resources: `users`, `roles`, `banners`, `settings`, `sections`, `subscribe`, `categories`, `sub-categories`, `products`, `inventory`, `customers`, `orders`, `coupons` (and legacy entries). Actions: `create`, `read`, `update`, `delete`.

`isSuper` users get the extra database export/import capability. Public storefront reads (`GET /products/active`, `GET /categories/slug/:slug`, …) are unguarded by design.

---

## API Overview

Base URL: `http://localhost:3023` · Swagger UI: `http://localhost:3023/api` (non-production only)

Every request's `Host` header selects the tenant database, so the same endpoints return different data per host — and an unregistered host gets `404 Unknown tenant`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `PUT /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` · `DELETE /auth/logout` |
| Products | `POST /products` · `GET /products?categoryId=&subCategoryId=` · `GET /products/search?q=&categoryId=&subCategoryId=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=` · `GET /products/active` · `GET /products/slug/:slug` · `GET /products/:id` · `PATCH /products/:id` · `DELETE /products/:id` |
| Customer auth | `POST /customer-auth/register` · `login` · `refresh` · `forgot-password` · `reset-password` · `GET /customer-auth/me` · `PUT /customer-auth/change-password` · `DELETE /customer-auth/logout` |
| Customer self-service | `GET|PATCH /customers/me` · `GET|POST /customers/me/addresses` · `PATCH|DELETE /customers/me/addresses/:id` · `PUT /customers/me/addresses/:id/default` · `GET /customers/me/wishlist` · `PUT|DELETE /customers/me/wishlist/:productId` |
| Customers (admin) | `GET /customers` · `GET /customers/:id` · `PATCH /customers/:id/active` |
| Orders (public) | `POST /orders/quote` (`{ items, couponCode? }`) |
| Orders (customer) | `POST /orders/me` · `GET /orders/me` · `GET /orders/me/:id` · `POST /orders/me/:id/cancel` |
| Orders (admin) | `GET /orders?status=&search=&from=&to=` · `GET /orders/:id` · `PATCH /orders/:id/status` |
| Inventory | `GET /inventory` · `GET /inventory/summary` · `GET /inventory/low-stock` · `GET /inventory/movements` · `POST /inventory/adjust` · `POST /inventory/bulk-adjust` · `POST /inventory/stock-take` |
| Categories | `POST /categories` · `GET /categories` · `GET /categories/active` · `GET /categories/slug/:slug` · `GET /categories/:id` · `PATCH /categories/:id` · `DELETE /categories/:id` |
| Sub-categories | same shape as categories |
| Banners | `POST /banners` · `GET /banners` · `GET /banners/:id` · `PATCH /banners/:id` · `PATCH /banners/:id/weight` · `DELETE /banners/:id` |
| Sections | `POST /sections` · `GET /sections` · `GET /sections/name/:sectionName` · `GET /sections/:id` · `PATCH /sections/:id` · `DELETE /sections/:id` |
| Settings | `GET /settings` · `PATCH /settings` |
| Subscribe | `POST /subscribe` · `GET /subscribe` · `GET /subscribe/:id` · `DELETE /subscribe/:id` |
| Coupons | `POST /coupons` · `GET /coupons?search=` · `GET /coupons/:id` · `PATCH /coupons/:id` · `DELETE /coupons/:id` |
| Roles | `POST /roles` · `GET /roles` · `GET /roles/:id` · `PUT /roles/:id` · `DELETE /roles/:id` |
| Database | `GET /database/export` · `POST /database/import` *(super admin)* |

Uploaded files are served statically from `/uploads`.

---

## Getting Started

### Requirements
- Node.js 20+
- MongoDB 7.0+ running as a **replica set** (see below), locally or as a connection string

### MongoDB replica set

Money-moving writes run as multi-document transactions, which a standalone `mongod` refuses. On connect, the API logs a warning for any store whose database isn't a replica-set member, and transactional operations (currently the database import) answer `503` there. A single-node replica set is enough for development.

With Docker, run it on 27017 in place of a standalone server:

```bash
docker run -d --name mongo-rs -p 27017:27017 -v mongo-rs:/data/db mongo:8.0 --replSet rs0 --bind_ip_all
docker exec mongo-rs mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

or convert a local `mongod` you already have, keeping its data: restart it with `--replSet rs0` (or `replication.replSetName: rs0` in `mongod.conf`), then run `rs.initiate()` once in `mongosh`. To move data from a standalone server into the Docker one, `mongodump` it first and `mongorestore` into the new server.

Tenant URIs then name the set: `mongodb://localhost:27017/demo?replicaSet=rs0`.

In production use three data-bearing members (no arbiter) or MongoDB Atlas, with `retryWrites=true&w=majority`.

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3023
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:3000   # fallback for email links when a host has no frontendUrl

MAIL_USER=you@example.com
MAIL_PASS=app-password

# CORS_ORIGINS=http://localhost:3001     # extra origins beyond each tenant's frontendUrl
# TRUST_PROXY=1                         # behind nginx etc. — real client IP for rate limits

# Production: the tenant map lives here instead of src/config.json
# TENANT_MAP={"example.com":{"mongoUri":"mongodb+srv://…","frontendUrl":"https://example.com"}}

SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=StrongPassword123
SEED_SUPER_ADMIN_NAME=Super Admin
SEED_SUPER_ADMIN_EMAIL=super@example.com
SEED_SUPER_ADMIN_PASSWORD=StrongPassword123
```

Register your first tenant — this writes `backend/src/config.json` and seeds the database:

```bash
npm run add-tenant  # answer the prompts; use "localhost" as the hostname
npm run start:dev   # http://localhost:3023  ·  docs at /api
```

To seed an already-registered tenant later, pass its host: `npm run seed -- localhost`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3023
NEXT_PUBLIC_PORT=3000
```

```bash
npm run dev         # http://localhost:3000
```

Sign in at `/en/login` (or `/ar/login`) with the seeded admin credentials, then head to `/en/admin`.

To exercise multi-tenancy locally, add a second host to your `/etc/hosts` (`127.0.0.1 demo.localhost`), run `npm run add-tenant` again for it, restart the API (CORS picks up the new `frontendUrl`), and browse `http://demo.localhost:3000`.

---

## Project Layout

```
backend/
├── scripts/add-tenant.ts   interactive tenant registration + seeding CLI
└── src/
    ├── auth/              login, refresh, reset, OTP, user schemas
    ├── mail/              Nodemailer transport, reset-password emails
    ├── roles/             roles + resource/action enums
    ├── guards/            AuthenticationGuard, AuthorizationGuard
    ├── decorators/        @Permissions
    ├── products/  categories/  sub-categories/  banners/  sections/  settings/  subscribe/
    ├── inventory/        stock movements ledger, adjustments, stock takes, reports
    ├── customers/        customer profiles + embedded address book
    ├── customer-auth/    storefront sign-up/sign-in, separate tokens from admin
    ├── orders/           quote, checkout, order history, status workflow, order emails, order number counter
    ├── coupons/          coupon rules, redemption counting, admin CRUD
    ├── database/          JSON export / import (super admin)
    ├── common/
    │   ├── middleware/    TenantMiddleware (host → req.tenant)
    │   ├── tenant/        TENANT_CONNECTION provider, tenantModelProvider, schema registry
    │   ├── helpers/       TenantConnectionService, per-tenant upload storage, image compression
    │   └── schemas/ dto/  LocalizedField
    ├── config/            env → config mapping
    ├── config.json        host → { mongoUri, frontendUrl }   (git-ignored)
    ├── seeder.ts          bootstrap roles + admin users for one host
    └── main.ts            CORS, Swagger, global ValidationPipe

frontend/
├── app/[locale]/
│   ├── (website)/     storefront: home, products, categories, cart, checkout, account (profile, orders, addresses)
│   ├── admin/         dashboard: orders, products, categories, sub-categories, banners, sections, inventory, customers, settings, database
│   └── login/  forgot-password/  reset-password/
├── sections/          BannerSlider, CategoriesSlider, ProductsGrid
├── features/          per-entity forms (Product, Category, SubCategory, Banner, Section, Inventory, Customer)
├── backend-api/       typed queries + mutations per resource (React Query)
├── layouts/           Home and Dashboard shells
├── components/        shared UI, MUI wrappers, table, TipTap editor
├── Store/slices/      auth, customer, cart, settings, tenant, breadcrumbs
├── locales/{en,ar}/   translation bundles
├── lib/               axios instances (admin + customer), theme, i18n, providers, emotion/RTL cache
├── proxy.ts           locale detection (falls back to `ar`) + separate admin and customer route guards
└── config.json        languages, default language, RTL languages, theme color
```

## Scripts

| Where | Command | Does |
|---|---|---|
| backend | `npm run start:dev` | Nest in watch mode |
| backend | `npm run build` / `npm run start:prod` | compile / run `dist/main` |
| backend | `npm run add-tenant` | register a host in the tenant map, optionally seed it |
| backend | `npm run seed -- <host>` | seed roles and admin users for one tenant |
| backend | `npm run migrate:inventory -- <host>` | backfill stock fields + variant ids on pre-inventory data |
| backend | `npm run finance:backfill -- <host> [--apply]` | prepare existing orders for the books, grant finance permissions, reconcile |
| backend | `npm run normalize-ids -- <host> [--apply]` | convert reference ids stored as strings (from before the ObjectId schema fix) to ObjectIds |
| backend | `npm test` / `npm run test:e2e` | Jest unit / e2e |
| backend | `npm run lint` / `npm run format` | ESLint / Prettier |
| frontend | `npm run dev` / `npm run build` / `npm start` | Next.js dev / build / serve |
| frontend | `npm run lint` | ESLint |

## Notes

- `backend/src/config.json` and both env files are git-ignored — every tenant map is deployment-specific. Prefer `TENANT_MAP` in production.
- CORS origins come from each tenant's `frontendUrl` in the tenant map (read at boot — restart after `add-tenant`). Extra origins go in `CORS_ORIGINS`, comma-separated.
- Credential endpoints are rate-limited (`AuthThrottlerGuard`): login/register/subscribe 10 per minute, forgot-password 5 per 15 minutes, keyed by tenant + IP + submitted email. Behind a reverse proxy set `TRUST_PROXY` (hop count, e.g. `1`) so the real client IP is used. Counters are in memory, so they reset on restart and aren't shared between instances.
- Behind a reverse proxy with `TRUST_PROXY` set, Express takes the host from `X-Forwarded-Host`, and that host picks the store. The proxy must overwrite both headers rather than pass through the client's: in nginx, `proxy_set_header Host $host;` and `proxy_set_header X-Forwarded-Host $host;`.
- The in-app database tool is not a backup — take those at the database layer (`mongodump --db <store db>`, or Atlas backups). Its export is one store's data as Extended JSON, keeping ObjectIds and dates as real types, with login tokens left out. Import accepts only an export of the same store, only into a store with no orders, returns or stock history, and only with the super admin's password plus the store's host typed to confirm. It checks the file first (dry run), validates every document against its schema, and writes all collections in one transaction.
- Every price is validated as 0 or more with at most 2 decimals (piastres), in the API and the product CSV import. Settings carry the store's `currencyCode` (ISO 4217, `EGP`) and `timezone` (`Africa/Cairo`); only that store's super admin changes them, and the currency is frozen once the store has orders.
- A product that has been ordered or has stock history can't be deleted (`409`) — deactivate it instead.
- `MONGO_URL` is no longer used to open connections (every connection comes from the tenant map); it survives only as an unused entry in `config/config.ts`.
- Uploaded images are compressed to a max width of 1280px and normalized to jpeg/png/webp/avif; GIF and SVG pass through untouched.
