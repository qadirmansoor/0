# ERP — Accounts & Inventory

A small ERP built with Next.js (App Router), Prisma, and PostgreSQL. It covers:

- **Accounts**: chart of accounts, manual journal entries, general ledger, trial balance, customers/vendors, invoices, bills, payments.
- **Inventory**: items, warehouses, stock levels, stock adjustments, purchase orders, sales orders.

The two modules are integrated with real double-entry bookkeeping: fulfilling a sales order posts revenue/COGS and decrements stock in the same transaction; receiving a purchase order posts inventory/payables and increments stock; manual stock adjustments post a balancing journal entry so the trial balance always reconciles.

## Prerequisites

- Node.js 20+
- A PostgreSQL database

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:

   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/erp_db?schema=public"
   NEXTAUTH_SECRET="a-random-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. Run migrations and seed the database:

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

   The seed creates the standard chart of accounts, an admin user (`admin@erp.local` / `admin123`), a warehouse, a few sample items, and a sample customer/vendor.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded admin account.

## Windows desktop build

`electron-app/` packages this into a self-contained Windows `.exe` (Electron + a bundled, embedded PostgreSQL — no separate DB or Node install needed on the target machine). See [`electron-app/README.md`](electron-app/README.md) for how to build it and what has/hasn't been verified.

## ZimaOS / Docker (single container, built-in database)

`Dockerfile` builds a single self-contained image — the app plus a local PostgreSQL, both supervised by `docker/entrypoint.sh` — so it runs on ZimaOS (or any Docker host) with nothing else to install. On first start it initializes Postgres into the mounted `/data` volume, applies the schema, and seeds it (same admin login as above); every start after that just reuses the persisted data.

### Install on ZimaOS

A [GitHub Actions workflow](.github/workflows/docker-publish.yml) builds this image on every push and publishes it to `ghcr.io/qadirmansoor/erp-zimaos:latest` — so ZimaOS can just **pull** it instead of building locally (its "Install a customized app" screen takes a `docker-compose.yml`, but needs an image it can pull; it won't build from a Dockerfile itself). Over SSH on the ZimaOS box:

```bash
git clone <this repo> erp && cd erp
docker compose pull   # pulls ghcr.io/qadirmansoor/erp-zimaos:latest
docker compose up -d
```

If the GHCR package is private (default for a private repo), `docker login ghcr.io` first with a token that has `read:packages` scope — or make the package public from its GitHub settings page.

If you'd rather build locally instead of pulling (e.g. to test an uncommitted change), `docker compose build && docker compose up -d` uses the `build: .` fallback in `docker-compose.yml`.

Either way, then open `http://<zimaos-host>:3000`. Change the host port in `docker-compose.yml` (`"3000:3000"`) if 3000 is already taken.

### What's verified

The container's runtime logic reuses the same schema/seed code already smoke-tested end-to-end for the [Windows build](electron-app/README.md) (`docker/init-db.js` + `docker/seed.js` mirror `electron-app/main.js` + `electron-app/seed.js`, just talking to an apt-installed Postgres over `127.0.0.1` instead of an embedded one).

**Not built or run by me directly.** This sandbox's network policy blocks Docker Hub pulls entirely (confirmed via the proxy status endpoint — a policy-level 403, not a transient failure), so I couldn't pull even the base `node:20-bookworm-slim` image here. That's the whole reason the GitHub Actions workflow above exists: its runner has normal internet access, so it's the actual first build of this image. Check the [Actions tab](../../actions/workflows/docker-publish.yml) for whether it succeeded — if it's green, the image itself is confirmed to build; only the *runtime* behavior on an actual ZimaOS box (Postgres init, volume permissions, first-run seed) still needs a real test. If the workflow is red, likely spots:

1. **`postgresql` apt package version drift** — bookworm's version may change over time; the Dockerfile doesn't pin one.
2. **Permissions on the `/data` volume** — the entrypoint chowns it to `postgres:postgres` on every start; if ZimaOS mounts the volume with unusual ownership/`noexec`, that could need adjusting.
3. **Port conflicts** — the app listens on `3000` inside the container (mapped via compose); Postgres listens on `5432` but only on the container's loopback, not exposed.

## Notable design choices

- **Prisma 7 driver adapters**: the schema has no `url` in `datasource`; connections go through `@prisma/adapter-pg` (see `src/lib/prisma.ts` and `prisma.config.ts`).
- **Auth**: NextAuth v5 with a Credentials provider backed by `User.passwordHash` (bcrypt). `src/auth.config.ts` holds the edge-safe config used by `middleware.ts`; `src/auth.ts` adds the Prisma-backed provider for the Node runtime (route handlers, server actions).
- **Mutations**: implemented as Next.js Server Actions in `src/lib/actions/*`, not a separate REST API — pages fetch data directly via Prisma in server components.
- **Standard chart of accounts** (`src/lib/accounts-constants.ts`): Cash (1000), Accounts Receivable (1100), Inventory (1200), Accounts Payable (2000), Owner's Equity (3000), Sales Revenue (4000), Cost of Goods Sold (5000), General Expenses (5100), Inventory Adjustments (5200). Business logic in `src/lib/actions/*` posts to these by code, so renaming/removing them requires updating the constants and any custom accounts.
