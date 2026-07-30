const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1200", name: "Inventory", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" },
  { code: "4000", name: "Sales Revenue", type: "INCOME" },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
  { code: "5100", name: "General Expenses", type: "EXPENSE" },
  { code: "5200", name: "Inventory Adjustments", type: "EXPENSE" },
];

const ITEMS = [
  { sku: "SKU-001", name: "Widget A", unit: "EA", costPrice: 5, salePrice: 12, reorderLevel: 10 },
  { sku: "SKU-002", name: "Widget B", unit: "EA", costPrice: 8, salePrice: 18, reorderLevel: 10 },
  { sku: "SKU-003", name: "Gadget C", unit: "EA", costPrice: 20, salePrice: 45, reorderLevel: 5 },
];

const id = () => crypto.randomUUID();

async function seedDatabase(client) {
  const accountIds = {};
  for (const a of ACCOUNTS) {
    const accountId = id();
    accountIds[a.code] = accountId;
    await client.query(
      `insert into "Account" (id, code, name, type, "isActive", "updatedAt")
       values ($1, $2, $3, $4::"AccountType", true, now())
       on conflict (code) do nothing`,
      [accountId, a.code, a.name, a.type]
    );
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await client.query(
    `insert into "User" (id, name, email, "passwordHash", role)
     values ($1, 'Admin', 'admin@erp.local', $2, 'ADMIN')
     on conflict (email) do nothing`,
    [id(), passwordHash]
  );

  const warehouseId = id();
  await client.query(
    `insert into "Warehouse" (id, name, location)
     values ($1, 'Main Warehouse', 'Default location')
     on conflict (name) do nothing`,
    [warehouseId]
  );

  let openingInventoryValue = 0;
  for (const item of ITEMS) {
    const itemId = id();
    await client.query(
      `insert into "Item" (id, sku, name, unit, "costPrice", "salePrice", "reorderLevel")
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (sku) do nothing`,
      [itemId, item.sku, item.name, item.unit, item.costPrice, item.salePrice, item.reorderLevel]
    );

    await client.query(
      `insert into "StockLevel" (id, "itemId", "warehouseId", quantity)
       values ($1, $2, $3, 50)
       on conflict ("itemId", "warehouseId") do nothing`,
      [id(), itemId, warehouseId]
    );

    await client.query(
      `insert into "StockMovement" (id, "itemId", "warehouseId", type, quantity, reference, source, date)
       values ($1, $2, $3, 'ADJUSTMENT', 50, 'Opening balance', 'SEED', now())`,
      [id(), itemId, warehouseId]
    );

    openingInventoryValue += 50 * item.costPrice;
  }

  if (openingInventoryValue > 0) {
    const journalEntryId = id();
    await client.query(
      `insert into "JournalEntry" (id, date, memo, source)
       values ($1, now(), 'Opening inventory balance', 'SEED')`,
      [journalEntryId]
    );
    await client.query(
      `insert into "JournalLine" (id, "journalEntryId", "accountId", debit, credit)
       values ($1, $2, $3, $4, 0)`,
      [id(), journalEntryId, accountIds["1200"], openingInventoryValue]
    );
    await client.query(
      `insert into "JournalLine" (id, "journalEntryId", "accountId", debit, credit)
       values ($1, $2, $3, 0, $4)`,
      [id(), journalEntryId, accountIds["3000"], openingInventoryValue]
    );
  }

  await client.query(
    `insert into "Party" (id, name, type, email)
     values ($1, 'Acme Retail Co.', 'CUSTOMER', 'purchasing@acmeretail.example')
     on conflict (id) do nothing`,
    ["seed-customer"]
  );

  await client.query(
    `insert into "Party" (id, name, type, email)
     values ($1, 'Global Supply Co.', 'VENDOR', 'sales@globalsupply.example')
     on conflict (id) do nothing`,
    ["seed-vendor"]
  );
}

module.exports = { seedDatabase };
