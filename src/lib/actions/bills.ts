"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { nextBillNumber } from "@/lib/numbering";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

export async function createBill(formData: FormData) {
  const vendorId = String(formData.get("vendorId") ?? "");
  const date = new Date(String(formData.get("date")));
  const dueDate = formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null;
  const warehouseId = String(formData.get("warehouseId") ?? "") || null;

  const itemIds = formData.getAll("lineItemId") as string[];
  const descriptions = formData.getAll("lineDescription") as string[];
  const quantities = formData.getAll("lineQuantity") as string[];
  const unitPrices = formData.getAll("lineUnitPrice") as string[];

  const rawLines = descriptions.map((description, i) => ({
    itemId: itemIds[i] || null,
    description,
    quantity: round2(parseFloat(quantities[i] || "0") || 0),
    unitPrice: round2(parseFloat(unitPrices[i] || "0") || 0),
  }));

  const lines = rawLines.filter((l) => l.description && l.quantity > 0);

  if (!vendorId || lines.length === 0) {
    throw new Error("Vendor and at least one line item are required.");
  }

  const number = await nextBillNumber();

  await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const billLines = lines.map((l) => {
      const amount = round2(l.quantity * l.unitPrice);
      subtotal = round2(subtotal + amount);
      return { itemId: l.itemId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount };
    });

    const bill = await tx.bill.create({
      data: {
        number,
        vendorId,
        date,
        dueDate,
        status: "OPEN",
        subtotal,
        total: subtotal,
        lines: { create: billLines },
      },
    });

    if (warehouseId) {
      for (const l of lines) {
        if (!l.itemId) continue;
        await tx.stockMovement.create({
          data: {
            itemId: l.itemId,
            warehouseId,
            type: "IN",
            quantity: l.quantity,
            source: "BILL",
            sourceId: bill.id,
            date: new Date(),
          },
        });
        await tx.stockLevel.upsert({
          where: { itemId_warehouseId: { itemId: l.itemId, warehouseId } },
          create: { itemId: l.itemId, warehouseId, quantity: l.quantity },
          update: { quantity: { increment: l.quantity } },
        });
      }
    }

    const payableAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE);
    const inventoryAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY);
    const expenseAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.GENERAL_EXPENSES);

    const debitAccountId = warehouseId ? inventoryAccount.id : expenseAccount.id;

    await postJournalEntry(tx, {
      date,
      memo: `Bill ${bill.number}`,
      source: "BILL",
      sourceId: bill.id,
      lines: [
        { accountId: debitAccountId, debit: subtotal },
        { accountId: payableAccount.id, credit: subtotal },
      ],
    });
  });

  revalidatePath("/bills");
  revalidatePath("/inventory/stock");
  redirect("/bills");
}
