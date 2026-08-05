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
- Newsletter subscribe form and a floating WhatsApp button

**Admin dashboard (`/[locale]/admin`)**
- CRUD for products (with variants, tags, multiple images), categories, sub-categories, banners and content sections
- Site settings: title, description, logo, favicon, phone/WhatsApp/email/address, social media, primary color, currency
- Drag-and-drop ordering (`@dnd-kit`) and rich text editing (TipTap)
- Subscribers list
- Database export / import as JSON (super-admin only)
- Role-based permissions per resource and action

**Platform**
- JWT access + refresh tokens, forgot/reset password over email (Nodemailer), OTP support
- Image upload with automatic compression and format normalization (`sharp`)
- Swagger API docs at `/api`
- Seed script for roles, admin and super-admin users

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

Tenants are identified by **host**. Each host gets its own MongoDB database, its own frontend URL, and its own upload directory:

```jsonc
// backend/src/config.json  (git-ignored — one entry per tenant)
{
  "localhost":      { "mongoUri": "mongodb://127.0.0.1:27017/demo",    "frontendUrl": "http://localhost:3000" },
  "demo.localhost": { "mongoUri": "mongodb://127.0.0.1:27017/demo-db", "frontendUrl": "http://demo.localhost:3000" }
}
```

```
backend/uploads/
├── localhost/        { settings, banners, categories, products }
└── demo.localhost/   { settings, banners, categories, products }
```

Because every tenant has a separate database, tenant data is isolated by construction — no `tenantId` column and no risk of a missing `where` clause leaking one store's products into another.

On the frontend, `frontend/config.json` holds per-deployment app config (languages, default language, RTL languages, theme color), and the `tenant` Redux slice (`frontend/Store/slices/tenant.ts`) carries the active tenant's logo and currency into the UI. Visual identity beyond that — site title, favicon, primary color, contact details — lives in the `settings` collection, so it is per-tenant data rather than code.

> **Current state:** the host → database mapping in `config.json` and the per-host upload folders are in place, but `app.module.ts` still boots a single connection from `MONGO_URL`. To make routing dynamic, resolve the host per request and swap `MongooseModule.forRootAsync` for a request-scoped connection factory keyed on `req.headers.host`, reading `config.json`.

---

## Data Model

All user-facing text uses a shared `LocalizedField` (`{ en, ar }`), so a single document carries both languages.

| Collection | Notable fields |
|---|---|
| `Product` | `name`, `description`, `shortDescription`, `images[]`, `price`, `sku`, `category`, `subCategory`, `slug`, `tags[]`, `variants[{ label, price }]`, `isActive`, `order` |
| `Category` | `name`, `description`, `image`, `slug`, `isActive`, `order` |
| `SubCategory` | belongs to a category, same shape |
| `Banner` | `image`, `title`, `description`, `active`, `weight` |
| `Section` | `sectionName`, `title`, `description`, `image`, `type` (`DEFAULT` / `HIGHLIGHTS` / `GALLERY` / `LINKS`), `highlights[]`, `gallery[]`, `links[]` |
| `Setting` | site title/description, logo, favicon, phone, whatsapp, landline, email, address, `socialMedia[]`, `primaryColor`, `currency` |
| `User` | `name`, `email`, `password` (bcrypt), `isVerified`, `roleId`, `isSuper` |
| `Role` | `name`, `permissions[{ resource, actions }]` |
| `Subscribe` | newsletter signups |

Supporting collections: `RefreshToken`, `ResetToken`, `Otp`.

---

## Authorization

Two guards run in sequence:

- `AuthenticationGuard` — verifies the JWT `Bearer` token and attaches `userId` to the request.
- `AuthorizationGuard` — reads the `@Permissions([{ resource, actions }])` decorator on the route and checks it against the user's role.

Resources: `users`, `roles`, `banners`, `settings`, `sections`, `subscribe`, `categories`, `sub-categories`, `products` (and legacy entries). Actions: `create`, `read`, `update`, `delete`.

`isSuper` users get the extra database export/import capability. Public storefront reads (`GET /products/active`, `GET /categories/slug/:slug`, …) are unguarded by design.

---

## API Overview

Base URL: `http://localhost:3023` · Swagger UI: `http://localhost:3023/api`

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `PUT /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` · `DELETE /auth/logout` |
| Products | `POST /products` · `GET /products?categoryId=&subCategoryId=` · `GET /products/active` · `GET /products/slug/:slug` · `GET /products/:id` · `PATCH /products/:id` · `DELETE /products/:id` |
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
MONGO_URL=mongodb://127.0.0.1:27017/demo
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:3000

MAIL_USER=you@example.com
MAIL_PASS=app-password

SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=StrongPassword123
SEED_SUPER_ADMIN_NAME=Super Admin
SEED_SUPER_ADMIN_EMAIL=super@example.com
SEED_SUPER_ADMIN_PASSWORD=StrongPassword123
```

Create `backend/src/config.json` with your tenant map (see [Multi-Tenancy](#multi-tenancy)), then:

```bash
npm run seed        # creates roles + admin and super-admin users
npm run start:dev   # http://localhost:3023  ·  docs at /api
```

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

To exercise multi-tenancy locally, add a second host to your `/etc/hosts` (`127.0.0.1 demo.localhost`), give it an entry in `backend/src/config.json`, and browse `http://demo.localhost:3000`.

---

## Project Layout

```
backend/src/
├── auth/              login, refresh, reset, OTP, user schemas
├── roles/             roles + resource/action enums
├── guards/            AuthenticationGuard, AuthorizationGuard
├── decorators/        @Permissions
├── products/  categories/  sub-categories/  banners/  sections/  settings/  subscribe/
├── database/          JSON export / import (super admin)
├── common/            LocalizedField schema, image compression, nested-body parsing
├── config/            env → config mapping
├── config.json        host → { mongoUri, frontendUrl }   (git-ignored)
├── seeds/  seeder.ts  bootstrap data
└── main.ts            CORS, Swagger, global ValidationPipe

frontend/
├── app/[locale]/
│   ├── (website)/     storefront: home, products, categories
│   ├── admin/         dashboard: products, categories, sub-categories, banners, sections, settings, database
│   └── login/  forgot-password/  reset-password/
├── sections/          BannerSlider, CategoriesSlider, ProductsGrid
├── features/          per-entity forms (Product, Category, SubCategory, Banner, Section)
├── backend-api/       typed queries + mutations per resource (React Query)
├── layouts/           Home and Dashboard shells
├── components/        shared UI, MUI wrappers, table, TipTap editor
├── Store/slices/      auth, settings, tenant, breadcrumbs
├── locales/{en,ar}/   translation bundles
├── lib/               axios instance, theme, i18n, providers, emotion/RTL cache
├── proxy.ts           locale detection + admin/login route guards
└── config.json        languages, default language, RTL languages, theme color
```

## Scripts

| Where | Command | Does |
|---|---|---|
| backend | `npm run start:dev` | Nest in watch mode |
| backend | `npm run build` / `npm run start:prod` | compile / run `dist/main` |
| backend | `npm run seed` | seed roles and admin users |
| backend | `npm test` / `npm run test:e2e` | Jest unit / e2e |
| backend | `npm run lint` / `npm run format` | ESLint / Prettier |
| frontend | `npm run dev` / `npm run build` / `npm start` | Next.js dev / build / serve |
| frontend | `npm run lint` | ESLint |

## Notes

- `backend/src/config.json` and both env files are git-ignored — every tenant map is deployment-specific.
- Allowed CORS origins are hard-coded in `backend/src/main.ts`; add each tenant's frontend origin there before deploying.
- Uploaded images are compressed to a max width of 1280px and normalized to jpeg/png/webp/avif; GIF and SVG pass through untouched.
