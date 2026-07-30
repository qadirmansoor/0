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

## Notable design choices

- **Prisma 7 driver adapters**: the schema has no `url` in `datasource`; connections go through `@prisma/adapter-pg` (see `src/lib/prisma.ts` and `prisma.config.ts`).
- **Auth**: NextAuth v5 with a Credentials provider backed by `User.passwordHash` (bcrypt). `src/auth.config.ts` holds the edge-safe config used by `middleware.ts`; `src/auth.ts` adds the Prisma-backed provider for the Node runtime (route handlers, server actions).
- **Mutations**: implemented as Next.js Server Actions in `src/lib/actions/*`, not a separate REST API — pages fetch data directly via Prisma in server components.
- **Standard chart of accounts** (`src/lib/accounts-constants.ts`): Cash (1000), Accounts Receivable (1100), Inventory (1200), Accounts Payable (2000), Owner's Equity (3000), Sales Revenue (4000), Cost of Goods Sold (5000), General Expenses (5100), Inventory Adjustments (5200). Business logic in `src/lib/actions/*` posts to these by code, so renaming/removing them requires updating the constants and any custom accounts.
