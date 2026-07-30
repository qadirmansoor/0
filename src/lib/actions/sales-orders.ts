"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { nextSalesOrderNumber, nextInvoiceNumber } from "@/lib/numbering";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

export async function createSalesOrder(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const date = new Date(String(formData.get("date")));

  const itemIds = formData.getAll("lineItemId") as string[];
  const quantities = formData.getAll("lineQuantity") as string[];
  const unitPrices = formData.getAll("lineUnitPrice") as string[];

  const lines = itemIds
    .map((itemId, i) => ({
      itemId,
      quantity: round2(parseFloat(quantities[i] || "0") || 0),
      unitPrice: round2(parseFloat(unitPrices[i] || "0") || 0),
    }))
    .filter((l) => l.itemId && l.quantity > 0);

  if (!customerId || lines.length === 0) {
    throw new Error("Customer and at least one line item are required.");
  }

  const number = await nextSalesOrderNumber();

  const so = await prisma.salesOrder.create({
    data: {
      number,
      customerId,
      date,
      status: "OPEN",
      lines: { create: lines },
    },
  });

  revalidatePath("/sales-orders");
  redirect(`/sales-orders/${so.id}`);
}

export async function fulfillSalesOrder(salesOrderId: string, formData: FormData) {
  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (!warehouseId) throw new Error("Warehouse is required.");

  await prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUniqueOrThrow({
      where: { id: salesOrderId },
      include: { lines: { include: { item: true } } },
    });

    if (so.status === "CLOSED") throw new Error("Sales order already fulfilled.");

    const arAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE);
    const revenueAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.SALES_REVENUE);
    const inventoryAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY);
    const cogsAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.COST_OF_GOODS_SOLD);

    let subtotal = 0;
    let totalCost = 0;
    const invoiceLines = [];

    for (const line of so.lines) {
      const remaining = Number(line.quantity) - Number(line.quantityFulfilled);
      if (remaining <= 0) continue;

      const amount = round2(remaining * Number(line.unitPrice));
      subtotal = round2(subtotal + amount);
      totalCost = round2(totalCost + round2(remaining * Number(line.item.costPrice)));

      invoiceLines.push({
        itemId: line.itemId,
        description: line.item.name,
        quantity: remaining,
        unitPrice: Number(line.unitPrice),
        amount,
      });

      await tx.stockMovement.create({
        data: {
          itemId: line.itemId,
          warehouseId,
          type: "OUT",
          quantity: remaining,
          source: "SO",
          sourceId: so.id,
          date: new Date(),
        },
      });

      await tx.stockLevel.upsert({
        where: { itemId_warehouseId: { itemId: line.itemId, warehouseId } },
        create: { itemId: line.itemId, warehouseId, quantity: -remaining },
        update: { quantity: { decrement: remaining } },
      });

      await tx.salesOrderLine.update({
        where: { id: line.id },
        data: { quantityFulfilled: { increment: remaining } },
      });
    }

    if (invoiceLines.length === 0) throw new Error("Nothing left to fulfill.");

    const number = await nextInvoiceNumber();

    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId: so.customerId,
        date: new Date(),
        status: "OPEN",
        salesOrderId: so.id,
        subtotal,
        total: subtotal,
        lines: { create: invoiceLines },
      },
    });

    const journalLines = [
      { accountId: arAccount.id, debit: subtotal },
      { accountId: revenueAccount.id, credit: subtotal },
    ];
    if (totalCost > 0) {
      journalLines.push(
        { accountId: cogsAccount.id, debit: totalCost },
        { accountId: inventoryAccount.id, credit: totalCost }
      );
    }

    await postJournalEntry(tx, {
      date: new Date(),
      memo: `Invoice ${invoice.number} for ${so.number}`,
      source: "INVOICE",
      sourceId: invoice.id,
      lines: journalLines,
    });

    await tx.salesOrder.update({
      where: { id: so.id },
      data: { status: "CLOSED" },
    });
  });

  revalidatePath("/sales-orders");
  revalidatePath("/invoices");
  revalidatePath("/inventory/stock");
  redirect("/sales-orders");
}
