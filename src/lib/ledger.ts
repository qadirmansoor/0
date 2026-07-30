import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function postJournalEntry(
  tx: TxClient,
  params: {
    date: Date;
    memo?: string;
    reference?: string;
    source: string;
    sourceId?: string;
    lines: JournalLineInput[];
  }
) {
  const totalDebit = round2(params.lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round2(params.lines.reduce((s, l) => s + (l.credit ?? 0), 0));

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Journal entry not balanced: debit ${totalDebit} !== credit ${totalCredit}`
    );
  }

  return tx.journalEntry.create({
    data: {
      date: params.date,
      memo: params.memo,
      reference: params.reference,
      source: params.source,
      sourceId: params.sourceId,
      lines: {
        create: params.lines
          .filter((l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0)
          .map((l) => ({
            accountId: l.accountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            memo: l.memo,
          })),
      },
    },
  });
}

export async function getAccountByCode(tx: TxClient, code: string) {
  const account = await tx.account.findUnique({ where: { code } });
  if (!account) {
    throw new Error(`Required account with code ${code} not found. Run the seed script.`);
  }
  return account;
}
