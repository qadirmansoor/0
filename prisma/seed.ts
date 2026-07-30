import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STANDARD_ACCOUNT_CODES } from "../src/lib/accounts-constants";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ACCOUNTS = [
  { code: STANDARD_ACCOUNT_CODES.CASH, name: "Cash", type: "ASSET" as const },
  { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, name: "Accounts Receivable", type: "ASSET" as const },
  { code: STANDARD_ACCOUNT_CODES.INVENTORY, name: "Inventory", type: "ASSET" as const },
  { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE, name: "Accounts Payable", type: "LIABILITY" as const },
  { code: STANDARD_ACCOUNT_CODES.OWNERS_EQUITY, name: "Owner's Equity", type: "EQUITY" as const },
  { code: STANDARD_ACCOUNT_CODES.SALES_REVENUE, name: "Sales Revenue", type: "INCOME" as const },
  { code: STANDARD_ACCOUNT_CODES.COST_OF_GOODS_SOLD, name: "Cost of Goods Sold", type: "EXPENSE" as const },
  { code: STANDARD_ACCOUNT_CODES.GENERAL_EXPENSES, name: "General Expenses", type: "EXPENSE" as const },
  { code: STANDARD_ACCOUNT_CODES.INVENTORY_ADJUSTMENTS, name: "Inventory Adjustments", type: "EXPENSE" as const },
];

async function main() {
  for (const account of ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@erp.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@erp.local",
      passwordHash,
      role: "ADMIN",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { name: "Main Warehouse" },
    update: {},
    create: { name: "Main Warehouse", location: "Default location" },
  });

  const items = await Promise.all(
    [
      { sku: "SKU-001", name: "Widget A", unit: "EA", costPrice: 5, salePrice: 12, reorderLevel: 10 },
      { sku: "SKU-002", name: "Widget B", unit: "EA", costPrice: 8, salePrice: 18, reorderLevel: 10 },
      { sku: "SKU-003", name: "Gadget C", unit: "EA", costPrice: 20, salePrice: 45, reorderLevel: 5 },
    ].map((item) =>
      prisma.item.upsert({ where: { sku: item.sku }, update: {}, create: item })
    )
  );

  let openingInventoryValue = 0;

  for (const item of items) {
    const existing = await prisma.stockLevel.findUnique({
      where: { itemId_warehouseId: { itemId: item.id, warehouseId: warehouse.id } },
    });
    if (existing) continue;

    await prisma.stockLevel.create({
      data: { itemId: item.id, warehouseId: warehouse.id, quantity: 50 },
    });
    await prisma.stockMovement.create({
      data: {
        itemId: item.id,
        warehouseId: warehouse.id,
        type: "ADJUSTMENT",
        quantity: 50,
        reference: "Opening balance",
        source: "SEED",
      },
    });
    openingInventoryValue += 50 * Number(item.costPrice);
  }

  if (openingInventoryValue > 0) {
    const inventoryAccount = await prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.INVENTORY },
    });
    const equityAccount = await prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.OWNERS_EQUITY },
    });

    await prisma.journalEntry.create({
      data: {
        date: new Date(),
        memo: "Opening inventory balance",
        source: "SEED",
        lines: {
          create: [
            { accountId: inventoryAccount.id, debit: openingInventoryValue, credit: 0 },
            { accountId: equityAccount.id, debit: 0, credit: openingInventoryValue },
          ],
        },
      },
    });
  }

  await prisma.party.upsert({
    where: { id: "seed-customer" },
    update: {},
    create: {
      id: "seed-customer",
      name: "Acme Retail Co.",
      type: "CUSTOMER",
      email: "purchasing@acmeretail.example",
    },
  });

  await prisma.party.upsert({
    where: { id: "seed-vendor" },
    update: {},
    create: {
      id: "seed-vendor",
      name: "Global Supply Co.",
      type: "VENDOR",
      email: "sales@globalsupply.example",
    },
  });

  console.log("Seed complete. Admin login: admin@erp.local / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
