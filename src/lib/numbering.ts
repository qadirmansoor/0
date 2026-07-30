import { prisma } from "@/lib/prisma";

async function nextNumber(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextInvoiceNumber() {
  const count = await prisma.invoice.count();
  return nextNumber("INV", count);
}

export async function nextBillNumber() {
  const count = await prisma.bill.count();
  return nextNumber("BILL", count);
}

export async function nextPurchaseOrderNumber() {
  const count = await prisma.purchaseOrder.count();
  return nextNumber("PO", count);
}

export async function nextSalesOrderNumber() {
  const count = await prisma.salesOrder.count();
  return nextNumber("SO", count);
}
