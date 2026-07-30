"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { nextInvoiceNumber } from "@/lib/numbering";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

export async function createInvoice(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
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

  if (!customerId || lines.length === 0) {
    throw new Error("Customer and at least one line item are required.");
  }

  const number = await nextInvoiceNumber();

  await prisma.$transaction(async (tx) => {
    const items = await tx.item.findMany({
      where: { id: { in: lines.map((l) => l.itemId).filter((v): v is string => !!v) } },
    });
    const itemsById = new Map(items.map((it) => [it.id, it]));

    let subtotal = 0;
    let totalCost = 0;
    const invoiceLines = lines.map((l) => {
      const amount = round2(l.quantity * l.unitPrice);
      subtotal = round2(subtotal + amount);
      if (l.itemId && itemsById.has(l.itemId)) {
        totalCost = round2(totalCost + round2(l.quantity * Number(itemsById.get(l.itemId)!.costPrice)));
      }
      return { itemId: l.itemId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount };
    });

    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId,
        date,
        dueDate,
        status: "OPEN",
        subtotal,
        total: subtotal,
        lines: { create: invoiceLines },
      },
    });

    if (warehouseId) {
      for (const l of lines) {
        if (!l.itemId) continue;
        await tx.stockMovement.create({
          data: {
            itemId: l.itemId,
            warehouseId,
            type: "OUT",
            quantity: l.quantity,
            source: "INVOICE",
            sourceId: invoice.id,
            date: new Date(),
          },
        });
        await tx.stockLevel.upsert({
          where: { itemId_warehouseId: { itemId: l.itemId, warehouseId } },
          create: { itemId: l.itemId, warehouseId, quantity: -l.quantity },
          update: { quantity: { decrement: l.quantity } },
        });
      }
    }

    const arAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE);
    const revenueAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.SALES_REVENUE);
    const inventoryAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY);
    const cogsAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.COST_OF_GOODS_SOLD);

    const journalLines = [
      { accountId: arAccount.id, debit: subtotal },
      { accountId: revenueAccount.id, credit: subtotal },
    ];
    if (warehouseId && totalCost > 0) {
      journalLines.push(
        { accountId: cogsAccount.id, debit: totalCost },
        { accountId: inventoryAccount.id, credit: totalCost }
      );
    }

    await postJournalEntry(tx, {
      date,
      memo: `Invoice ${invoice.number}`,
      source: "INVOICE",
      sourceId: invoice.id,
      lines: journalLines,
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/inventory/stock");
  redirect("/invoices");
}
