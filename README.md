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
- Bilingual content (English / Arabic) with full RTL support
- Per-tenant branding: logo, favicon, colors, currency, contact info and social links
- Floating WhatsApp button wired to the tenant's `settings`
- Customer accounts (`/[locale]/account`): register, sign in, profile, password reset and a saved address book
- Cart (`/cart`), checkout (`/checkout`) with cash on delivery, and order history with self-service cancellation (`/account/orders`)

**Admin dashboard (`/[locale]/admin`)**
- CRUD for products (with variants, tags, multiple images), categories, sub-categories, banners and content sections
- Site settings: title, description, logo, favicon, phone/WhatsApp/email/address, social media, primary color, currency
- Drag-and-drop ordering (`@dnd-kit`) and rich text editing (TipTap)
- Stock tracking with an append-only movement ledger, low-stock flags and stock takes
- Orders: list with status filter and search, order detail, status changes (confirm → ship → deliver, or cancel) with an audit trail
- Customer directory with the ability to block an account without losing its history
- Database export / import as JSON (super-admin only)
- Role-based permissions per resource and action

**Platform**
- Host-based multi-tenancy: one process, one database per tenant, resolved per request
- `npm run add-tenant` — interactive CLI that registers a host and seeds its database
- JWT access + refresh tokens, forgot/reset password over email (Nodemailer), OTP support
- Image upload with automatic compression and format normalization (`sharp`), stored per tenant
- Swagger API docs at `/api` (disabled when `NODE_ENV=production`)
- Newsletter subscribe endpoints (`/subscribe`) — API only, no UI wired up yet

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
| `Customer` | `name`, `email`, `password` (bcrypt), `phone`, `isVerified`, `isActive`, `addresses[{ _id, label, fullName, phone, city, area, street, building, notes, isDefault }]` |
| `Category` | `name`, `description`, `image`, `slug`, `isActive`, `order` |
| `SubCategory` | belongs to a category, same shape |
| `Banner` | `image`, `title`, `description`, `active`, `weight` |
| `Section` | `sectionName`, `title`, `description`, `image`, `type` (`DEFAULT` / `HIGHLIGHTS` / `GALLERY` / `LINKS`), `highlights[]`, `gallery[]`, `links[]` |
| `Setting` | site title/description, logo, favicon, phone, whatsapp, landline, email, address, `socialMedia[]`, `primaryColor`, `currency` |
| `User` | `name`, `email`, `password` (bcrypt), `isVerified`, `roleId`, `isSuper` |
| `Role` | `name`, `permissions[{ resource, actions }]` |
| `Subscribe` | newsletter signups |
| `Order` | `orderNumber`, `customer`, `items[{ product, variantId, name, variantLabel, sku, image, unitPrice, quantity, lineTotal, stockDeducted }]`, `shippingAddress`, `subtotal`, `shippingFee`, `total`, `currency`, `paymentMethod`, `status`, `statusHistory[]`, `notes` |

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

Movement types and their direction: `opening`, `purchase`, `return`, `order_cancelled` add stock; `sale` and `damage` remove it; `adjustment` carries its own sign and is the only type accepting a negative quantity.

### Overselling

Stock is applied with a conditional `$inc` — `{ stock: { $gte: quantity } }` for products, an `$elemMatch` guard plus `arrayFilters` for variants. Two concurrent sales of the last unit cannot both succeed; the loser gets `400 Not enough stock: N available, M requested`. `bulk-adjust` applies items one by one and reverses whatever already landed if a later one fails, since multi-document transactions would require a replica set.

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
3. The order is written as `pending` with a snapshot of names, prices and the shipping address — later catalogue edits never rewrite a receipt.
4. Stock is taken through `InventoryService.adjustMany` as `sale` movements referencing `Order #N`. If a concurrent checkout got there first, the movements roll back, the order is deleted, and the customer gets `409` and is sent back to the cart.

Order numbers come from an atomic `$inc` on a `Counter` document, starting at 1001 per tenant.

### Status

```
pending ──► confirmed ──► shipped ──► delivered
   │            │            │
   └────────────┴────────────┴──► cancelled
```

Transitions outside this graph are refused (`ORDER_TRANSITIONS`). Each change is a conditional update on the status that was read, so two admins acting at once can't both succeed — which matters because **cancelling returns stock** as `order_cancelled` movements, only for lines that actually deducted it. Restocking is best-effort per line: a product deleted since the sale is logged and skipped rather than blocking the cancellation.

Existing tenants need their admin roles re-seeded to get the new `orders` permission: `npm run seed -- <host>`.

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

Resources: `users`, `roles`, `banners`, `settings`, `sections`, `subscribe`, `categories`, `sub-categories`, `products`, `inventory`, `customers`, `orders` (and legacy entries). Actions: `create`, `read`, `update`, `delete`.

`isSuper` users get the extra database export/import capability. Public storefront reads (`GET /products/active`, `GET /categories/slug/:slug`, …) are unguarded by design.

---

## API Overview

Base URL: `http://localhost:3023` · Swagger UI: `http://localhost:3023/api` (non-production only)

Every request's `Host` header selects the tenant database, so the same endpoints return different data per host — and an unregistered host gets `404 Unknown tenant`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `PUT /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` · `DELETE /auth/logout` |
| Products | `POST /products` · `GET /products?categoryId=&subCategoryId=` · `GET /products/active` · `GET /products/slug/:slug` · `GET /products/:id` · `PATCH /products/:id` · `DELETE /products/:id` |
| Customer auth | `POST /customer-auth/register` · `login` · `refresh` · `forgot-password` · `reset-password` · `GET /customer-auth/me` · `PUT /customer-auth/change-password` · `DELETE /customer-auth/logout` |
| Customer self-service | `GET|PATCH /customers/me` · `GET|POST /customers/me/addresses` · `PATCH|DELETE /customers/me/addresses/:id` · `PUT /customers/me/addresses/:id/default` |
| Customers (admin) | `GET /customers` · `GET /customers/:id` · `PATCH /customers/:id/active` |
| Orders (public) | `POST /orders/quote` |
| Orders (customer) | `POST /orders/me` · `GET /orders/me` · `GET /orders/me/:id` · `POST /orders/me/:id/cancel` |
| Orders (admin) | `GET /orders?status=&search=&from=&to=` · `GET /orders/:id` · `PATCH /orders/:id/status` |
| Inventory | `GET /inventory` · `GET /inventory/summary` · `GET /inventory/low-stock` · `GET /inventory/movements` · `POST /inventory/adjust` · `POST /inventory/bulk-adjust` · `POST /inventory/stock-take` |
| Categories | `POST /categories` · `GET /categories` · `GET /categories/active` · `GET /categories/slug/:slug` · `GET /categories/:id` · `PATCH /categories/:id` · `DELETE /categories/:id` |
| Sub-categories | same shape as categories |
| Banners | `POST /banners` · `GET /banners` · `GET /banners/:id` · `PATCH /banners/:id` · `PATCH /banners/:id/weight` · `DELETE /banners/:id` |
| Sections | `POST /sections` · `GET /sections` · `GET /sections/name/:sectionName` · `GET /sections/:id` · `PATCH /sections/:id` · `DELETE /sections/:id` |
| Settings | `GET /settings` · `PATCH /settings` |
| Subscribe | `POST /subscribe` · `GET /subscribe` · `GET /subscribe/:id` · `DELETE /subscribe/:id` |
| Roles | `POST /roles` · `GET /roles` · `GET /roles/:id` · `PUT /roles/:id` · `DELETE /roles/:id` |
| Database | `GET /database/export` · `POST /database/import` *(super admin)* |

Uploaded files are served statically from `/uploads`.

---

## Getting Started

### Requirements
- Node.js 20+
- MongoDB running locally (or a connection string)

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
    ├── orders/           quote, checkout, order history, status workflow, order number counter
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
| backend | `npm test` / `npm run test:e2e` | Jest unit / e2e |
| backend | `npm run lint` / `npm run format` | ESLint / Prettier |
| frontend | `npm run dev` / `npm run build` / `npm start` | Next.js dev / build / serve |
| frontend | `npm run lint` | ESLint |

## Notes

- `backend/src/config.json` and both env files are git-ignored — every tenant map is deployment-specific. Prefer `TENANT_MAP` in production.
- CORS origins come from each tenant's `frontendUrl` in the tenant map (read at boot — restart after `add-tenant`). Extra origins go in `CORS_ORIGINS`, comma-separated.
- Credential endpoints are rate-limited (`AuthThrottlerGuard`): login/register/subscribe 10 per minute, forgot-password 5 per 15 minutes, keyed by tenant + IP + submitted email. Behind a reverse proxy set `TRUST_PROXY` (hop count, e.g. `1`) so the real client IP is used. Counters are in memory, so they reset on restart and aren't shared between instances.
- `MONGO_URL` is no longer used to open connections (every connection comes from the tenant map); it survives only as an unused entry in `config/config.ts`.
- Uploaded images are compressed to a max width of 1280px and normalized to jpeg/png/webp/avif; GIF and SVG pass through untouched.
