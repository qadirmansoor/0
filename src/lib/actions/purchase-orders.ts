"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { nextPurchaseOrderNumber, nextBillNumber } from "@/lib/numbering";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

export async function createPurchaseOrder(formData: FormData) {
  const vendorId = String(formData.get("vendorId") ?? "");
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

  if (!vendorId || lines.length === 0) {
    throw new Error("Vendor and at least one line item are required.");
  }

  const number = await nextPurchaseOrderNumber();

  const po = await prisma.purchaseOrder.create({
    data: {
      number,
      vendorId,
      date,
      status: "OPEN",
      lines: { create: lines },
    },
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${po.id}`);
}

export async function receivePurchaseOrder(purchaseOrderId: string, formData: FormData) {
  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (!warehouseId) throw new Error("Warehouse is required.");

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });

    if (po.status === "CLOSED") throw new Error("Purchase order already received.");

    const inventoryAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.INVENTORY);
    const payableAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE);

    let subtotal = 0;
    const billLines = po.lines.map((line) => {
      const remaining = Number(line.quantity) - Number(line.quantityReceived);
      const amount = round2(remaining * Number(line.unitPrice));
      subtotal = round2(subtotal + amount);
      return {
        itemId: line.itemId,
        description: `PO ${po.number} line`,
        quantity: remaining,
        unitPrice: Number(line.unitPrice),
        amount,
        poLineId: line.id,
        remaining,
      };
    });

    for (const line of billLines) {
      if (line.remaining <= 0) continue;

      await tx.stockMovement.create({
        data: {
          itemId: line.itemId,
          warehouseId,
          type: "IN",
          quantity: line.remaining,
          source: "PO",
          sourceId: po.id,
          date: new Date(),
        },
      });

      await tx.stockLevel.upsert({
        where: { itemId_warehouseId: { itemId: line.itemId, warehouseId } },
        create: { itemId: line.itemId, warehouseId, quantity: line.remaining },
        update: { quantity: { increment: line.remaining } },
      });

      await tx.purchaseOrderLine.update({
        where: { id: line.poLineId },
        data: { quantityReceived: { increment: line.remaining } },
      });
    }

    const number = await nextBillNumber();

    const bill = await tx.bill.create({
      data: {
        number,
        vendorId: po.vendorId,
        date: new Date(),
        status: "OPEN",
        purchaseOrderId: po.id,
        subtotal,
        total: subtotal,
        lines: {
          create: billLines
            .filter((l) => l.remaining > 0)
            .map((l) => ({
              itemId: l.itemId,
              description: l.description,
              quantity: l.remaining,
              unitPrice: l.unitPrice,
              amount: l.amount,
            })),
        },
      },
    });

    await postJournalEntry(tx, {
      date: new Date(),
      memo: `Bill ${bill.number} for ${po.number}`,
      source: "BILL",
      sourceId: bill.id,
      lines: [
        { accountId: inventoryAccount.id, debit: subtotal },
        { accountId: payableAccount.id, credit: subtotal },
      ],
    });

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "CLOSED" },
    });
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/bills");
  revalidatePath("/inventory/stock");
  redirect("/purchase-orders");
}
