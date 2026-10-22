# Platform dashboard

Manage the stores (tenants) the backend serves: add, edit, disable and remove hosts, check each store's database connection, and seed a new store's admin users. React + Vite + MUI.

## Backend setup

The dashboard needs the tenant registry and a platform admin. Add these to `backend/.env`:

```bash
# Its own database — not one of the stores'. Existing TENANT_MAP / config.json
# tenants are imported into it on first start; after that the registry is the
# source of truth and TENANT_MAP / config.json are ignored.
PLATFORM_MONGO_URL=mongodb://127.0.0.1:27017/platform?replicaSet=rs0

PLATFORM_ADMIN_EMAIL=you@example.com
# bcrypt hash, from: node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'your-password'
PLATFORM_ADMIN_PASSWORD_HASH='$2b$12$...'

# Let the dashboard call the API
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Restart the backend. Connection strings are stored encrypted with `ENCRYPTION_KEY`, so keep that key stable.

## Run

```bash
cp .env.example .env.local   # VITE_API_URL = the backend's URL
npm install
npm run dev                  # http://localhost:5173
```

`npm run build` writes a static site to `dist/`. Serve it from any static host, and add its origin to `CORS_ORIGINS`.

## What each action does

| Action | Effect |
|---|---|
| Add store | Registers a host → database. Served within seconds on every API instance, with no restart. CORS allows its frontend URL immediately. |
| Edit | Changes the frontend URL, alias, or connection string. A blank connection string keeps the current one. |
| Disable | The API answers 404 for the host and its aliases. Data is kept. |
| Remove | Unregisters the host. The database is **not** dropped. A store with aliases can't be removed until they are. |
| Check connection | Opens a throwaway connection: round trip, transaction support, collection and admin-user counts. |
| Seed admin users | Creates the `admin` / `super_admin` roles and users, like `npm run seed`. Existing users are left alone. |

The API never returns credentials: the list shows connection strings with `user:password` replaced by `***`.
