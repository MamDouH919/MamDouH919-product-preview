# Deploying to the Server

Two parts:

- **Section A** sets up the project on a new server.
- **Section B** updates a server that already runs an older version. Use this one for normal updates.

Paths and process names below (`/var/www/mahmoud-feda`, `api`, `web`) are examples. Change them to match your server.
The guide assumes **PM2** runs the apps and **nginx** sits in front of them.

---

## Before you start (on your machine)

The server can only pull what is on GitHub, so push your changes first:

```bash
git status                 # check nothing you need is left uncommitted
git add -A && git commit -m "..."
git push origin main
```

---

## A. First-time setup

### 1. Requirements on the server

- Node.js 20+ and npm
- PM2: `npm i -g pm2`
- MongoDB 7+ running as a **replica set**, or MongoDB Atlas. Orders, finance and import use transactions, and a standalone `mongod` refuses those.
- nginx

### 2. Get the code

```bash
cd /var/www
git clone https://github.com/MamDouH919/MamDouH919-product-preview.git mahmoud-feda
cd mahmoud-feda
```

### 3. Backend

```bash
cd backend
npm ci
nano .env                  # see "Backend .env" below
npm run build
pm2 start dist/main.js --name api
```

Register each store (host) and seed its admin users:

```bash
npm run add-tenant         # prints a TENANT_MAP line: put it in .env
npm run seed -- <host>     # e.g. npm run seed -- gravity.novaslash.com
pm2 restart api --update-env
```

### 4. Frontend

```bash
cd ../frontend
npm ci
nano .env.local            # see "Frontend .env.local" below
npm run build
pm2 start npm --name web -- start -- -p 3000
```

### 5. Keep PM2 running after a reboot

```bash
pm2 save
pm2 startup                # run the command it prints
```

### 6. nginx

Each API host proxies to the backend port. Each store host proxies to the frontend port. The API **must** overwrite the host headers, because the host decides which store is used:

```nginx
location / {
    proxy_pass http://127.0.0.1:3023;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
}
```

After editing: `sudo nginx -t && sudo systemctl reload nginx`.

---

## B. Updating an existing server

Run these in order.

### 1. Back up the databases

Do this every time, before anything else:

```bash
mkdir -p ~/backups/$(date +%F)
mongodump --uri "<store mongo uri>" --out ~/backups/$(date +%F)    # repeat for each store
tar czf ~/backups/$(date +%F)/uploads.tgz -C /var/www/mahmoud-feda/backend uploads
```

### 2. Pull the new code

```bash
cd /var/www/mahmoud-feda
git status                 # if the server has local edits, stash or commit them first
git log --oneline -1       # note the current commit, so you can roll back
git pull origin main
```

### 3. Check the env files

Compare the server's `backend/.env` with the list below and add anything missing. These variables were added in recent versions:

| Variable | Needed? | Notes |
|---|---|---|
| `ENCRYPTION_KEY` | Recommended | Encrypts each store's SMTP password. If it is not set, `JWT_SECRET` is used. **If stores already saved SMTP passwords, setting a new key makes those passwords unreadable**, and you must enter them again in each store's settings. |
| `TRUST_PROXY=1` | Yes, behind nginx | Gives rate limits the real client IP. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Optional | Saves images to Cloudflare R2. If any of them is missing, images are saved in `./uploads` as before. |
| `TENANT_MAP` | Yes, in production | Must contain every store host. |

If you add a new API domain or an image host, also add it to `imageBackends` in `frontend/next.config.ts` and commit the change. Do not edit that file only on the server.

### 4. Build the backend

```bash
cd backend
npm ci
npm run build
```

### 5. Run the data migrations, once for each store

All of these scripts can be run again safely. The ones with `--apply` change nothing without that flag, so run each one **without** `--apply` first, read the report, and then run it with `--apply`.

If the server's code is older than a feature, run that feature's script. If you are unsure, run them all; a script with nothing to do does nothing.

```bash
HOST=gravity.novaslash.com            # repeat this block for each store host

# Roles and permissions: grants permissions added by new features (inventory, finance, ...)
npm run seed -- $HOST

# Inventory: adds stock fields and variant ids to old products
npm run migrate:inventory -- $HOST

# Ids saved as text are converted to real ObjectIds
npm run normalize-ids -- $HOST              # report
npm run normalize-ids -- $HOST --apply

# Finance: prepares old orders for the books and runs the reconciliation checks
npm run finance:backfill -- $HOST           # report
npm run finance:backfill -- $HOST --apply
```

**Only if you are moving images to Cloudflare R2** (the R2 variables must be set first):

```bash
npm run migrate:r2 -- $HOST                 # report
npm run migrate:r2 -- $HOST --apply
```

Keep `./uploads` until you have checked the site. The script does not delete those files.

> Do **not** run `npm run seed:products` in production. It fills a store with demo products.

### 6. Restart the backend

```bash
pm2 restart api --update-env
pm2 logs api --lines 50    # check for errors and "not a replica set" warnings
```

### 7. Build and restart the frontend

```bash
cd ../frontend
npm ci
npm run build              # if this fails, the old build keeps running
pm2 restart web
```

### 8. Check that it works

- Open each store's home page, a product page, and the cart.
- Sign in to `/en/admin`. Check orders, products, and settings.
- Upload a test image and confirm it loads.
- Run `pm2 status`. Both apps should show `online`.

---

## Rolling back

```bash
cd /var/www/mahmoud-feda
git checkout <commit you noted in step B.2>
cd backend && npm ci && npm run build && pm2 restart api
cd ../frontend && npm ci && npm run build && pm2 restart web
```

If a migration damaged data, restore from the backup:

```bash
mongorestore --uri "<store mongo uri>" --drop ~/backups/<date>/<db name>
```

Afterwards, return to the latest code with `git checkout main`.

---

## Reference

### Backend `.env`

```env
PORT=3023
NODE_ENV=production
JWT_SECRET=<long random string>
ENCRYPTION_KEY=<long random string>      # see the warning in B.3
FRONTEND_URL=https://gravity.novaslash.com
TRUST_PROXY=1
# CORS_ORIGINS=https://extra-origin.com

MAIL_USER=...
MAIL_PASS=...

TENANT_MAP={"api-gravity.novaslash.com":{"mongoUri":"mongodb+srv://...","frontendUrl":"https://gravity.novaslash.com"}}

SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=...
SEED_ADMIN_PASSWORD=...
SEED_SUPER_ADMIN_NAME=Super Admin
SEED_SUPER_ADMIN_EMAIL=...
SEED_SUPER_ADMIN_PASSWORD=...

# Optional: Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

Generate a random secret with `openssl rand -hex 32`.

### Frontend `.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=https://api-gravity.novaslash.com
NEXT_PUBLIC_PORT=3000
```

`NEXT_PUBLIC_*` values are built into the frontend, so **run `npm run build` again after changing them**.

### Useful commands

```bash
pm2 status
pm2 logs api               # or: pm2 logs web
pm2 restart api --update-env
```
