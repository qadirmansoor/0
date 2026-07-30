"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { postJournalEntry, round2 } from "@/lib/ledger";
import type { AccountType } from "@/generated/prisma/enums";

export async function createAccount(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AccountType;
  const parentId = String(formData.get("parentId") ?? "") || null;

  if (!code || !name || !type) {
    throw new Error("Code, name and type are required.");
  }

  await prisma.account.create({
    data: { code, name, type, parentId },
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccount(accountId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  await prisma.account.update({
    where: { id: accountId },
    data: { name, isActive },
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function createJournalEntry(formData: FormData) {
  const date = new Date(String(formData.get("date")));
  const memo = String(formData.get("memo") ?? "");
  const reference = String(formData.get("reference") ?? "");

  const accountIds = formData.getAll("lineAccountId") as string[];
  const debits = formData.getAll("lineDebit") as string[];
  const credits = formData.getAll("lineCredit") as string[];
  const lineMemos = formData.getAll("lineMemo") as string[];

  const lines = accountIds
    .map((accountId, i) => ({
      accountId,
      debit: round2(parseFloat(debits[i] || "0") || 0),
      credit: round2(parseFloat(credits[i] || "0") || 0),
      memo: lineMemos[i] || undefined,
    }))
    .filter((l) => l.accountId && (l.debit !== 0 || l.credit !== 0));

  if (lines.length < 2) {
    throw new Error("A journal entry needs at least two lines.");
  }

  await prisma.$transaction(async (tx) => {
    await postJournalEntry(tx, {
      date,
      memo,
      reference,
      source: "MANUAL",
      lines,
    });
  });

  revalidatePath("/accounts/journal");
  redirect("/accounts/journal");
}
