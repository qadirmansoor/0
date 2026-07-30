"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

export async function createItem(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const costPrice = round2(parseFloat(String(formData.get("costPrice") ?? "0")) || 0);
  const salePrice = round2(parseFloat(String(formData.get("salePrice") ?? "0")) || 0);
  const reorderLevel = round2(parseFloat(String(formData.get("reorderLevel") ?? "0")) || 0);

  if (!sku || !name) {
    throw new Error("SKU and name are required.");
  }

  await prisma.item.create({
    data: { sku, name, description, unit, costPrice, salePrice, reorderLevel },
  });

  revalidatePath("/inventory/items");
  redirect("/inventory/items");
}

export async function updateItem(itemId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const costPrice = round2(parseFloat(String(formData.get("costPrice") ?? "0")) || 0);
  const salePrice = round2(parseFloat(String(formData.get("salePrice") ?? "0")) || 0);
  const reorderLevel = round2(parseFloat(String(formData.get("reorderLevel") ?? "0")) || 0);
  const isActive = formData.get("isActive") === "on";

  await prisma.item.update({
    where: { id: itemId },
    data: { name, description, unit, costPrice, salePrice, reorderLevel, isActive },
  });

  revalidatePath("/inventory/items");
  redirect("/inventory/items");
}

export async function createWarehouse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "") || null;

  if (!name) throw new Error("Name is required.");

  await prisma.warehouse.create({ data: { name, location } });

  revalidatePath("/inventory/warehouses");
  redirect("/inventory/warehouses");
}

export async function adjustStock(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const quantity = round2(parseFloat(String(formData.get("quantity") ?? "0")) || 0);
  const reference = String(formData.get("reference") ?? "") || null;

  if (!itemId || !warehouseId || quantity === 0) {
    throw new Error("Item, warehouse and a non-zero quantity are required.");
  }

  await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });

    await tx.stockMovement.create({
      data: {
        itemId,
        warehouseId,
        type: "ADJUSTMENT",
        quantity,
        reference,
        source: "MANUAL",
        date: new Date(),
      },
    });

    await tx.stockLevel.upsert({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      create: { itemId, warehouseId, quantity },
      update: { quantity: { increment: quantity } },
    });

    const value = round2(Math.abs(quantity) * Number(item.costPrice));
    if (value > 0) {
      const inventoryAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY);
      const adjustmentAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY_ADJUSTMENTS);

      await postJournalEntry(tx, {
        date: new Date(),
        memo: `Stock adjustment for ${item.sku}${reference ? ` (${reference})` : ""}`,
        source: "STOCK_ADJUSTMENT",
        lines:
          quantity > 0
            ? [
                { accountId: inventoryAccount.id, debit: value },
                { accountId: adjustmentAccount.id, credit: value },
              ]
            : [
                { accountId: adjustmentAccount.id, debit: value },
                { accountId: inventoryAccount.id, credit: value },
              ],
      });
    }
  });

  revalidatePath("/inventory/stock");
  redirect("/inventory/stock");
}
