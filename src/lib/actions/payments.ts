"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { round2, postJournalEntry, getAccountByCode } from "@/lib/ledger";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";
import type { DocStatus } from "@/generated/prisma/enums";

function statusForBalance(total: number, paid: number): DocStatus {
  if (paid <= 0) return "OPEN";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

export async function recordInvoicePayment(invoiceId: string, formData: FormData) {
  const amount = round2(parseFloat(String(formData.get("amount") ?? "0")) || 0);
  const method = String(formData.get("method") ?? "CASH");
  const date = new Date(String(formData.get("date") || new Date().toISOString()));

  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const newPaid = round2(Number(invoice.amountPaid) + amount);

    await tx.payment.create({
      data: {
        partyId: invoice.customerId,
        invoiceId: invoice.id,
        direction: "RECEIVED",
        amount,
        method,
        date,
      },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status: statusForBalance(Number(invoice.total), newPaid) },
    });

    const cashAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.CASH);
    const arAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE);

    await postJournalEntry(tx, {
      date,
      memo: `Payment received for ${invoice.number}`,
      source: "PAYMENT",
      sourceId: invoice.id,
      lines: [
        { accountId: cashAccount.id, debit: amount },
        { accountId: arAccount.id, credit: amount },
      ],
    });
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function recordBillPayment(billId: string, formData: FormData) {
  const amount = round2(parseFloat(String(formData.get("amount") ?? "0")) || 0);
  const method = String(formData.get("method") ?? "CASH");
  const date = new Date(String(formData.get("date") || new Date().toISOString()));

  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    const newPaid = round2(Number(bill.amountPaid) + amount);

    await tx.payment.create({
      data: {
        partyId: bill.vendorId,
        billId: bill.id,
        direction: "PAID",
        amount,
        method,
        date,
      },
    });

    await tx.bill.update({
      where: { id: bill.id },
      data: { amountPaid: newPaid, status: statusForBalance(Number(bill.total), newPaid) },
    });

    const cashAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.CASH);
    const apAccount = await getAccountByCode(tx, STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE);

    await postJournalEntry(tx, {
      date,
      memo: `Payment made for ${bill.number}`,
      source: "PAYMENT",
      sourceId: bill.id,
      lines: [
        { accountId: apAccount.id, debit: amount },
        { accountId: cashAccount.id, credit: amount },
      ],
    });
  });

  revalidatePath("/bills");
  redirect(`/bills/${billId}`);
}
