import { prisma } from "@/lib/prisma";
import {
  cardClass,
  formatDate,
  formatMoney,
  secondaryButtonClass,
  selectClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const selected = accountId || accounts[0]?.id;

  const lines = selected
    ? await prisma.journalLine.findMany({
        where: { accountId: selected },
        include: { journalEntry: true },
        orderBy: { journalEntry: { date: "asc" } },
      })
    : [];

  const account = accounts.find((a) => a.id === selected);
  const isDebitNormal = account?.type === "ASSET" || account?.type === "EXPENSE";

  const rows = lines.reduce<{ line: (typeof lines)[number]; balance: number }[]>((acc, l) => {
    const delta = isDebitNormal
      ? Number(l.debit) - Number(l.credit)
      : Number(l.credit) - Number(l.debit);
    const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    acc.push({ line: l, balance: previousBalance + delta });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">General Ledger</h1>

      <form method="get" className="flex max-w-lg items-end gap-2">
        <div className="flex-1">
          <select name="accountId" defaultValue={selected} className={selectClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={secondaryButtonClass}>
          View
        </button>
      </form>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Memo</th>
              <th className={thClass}>Debit</th>
              <th className={thClass}>Credit</th>
              <th className={thClass}>Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ line: l, balance }) => (
              <tr key={l.id}>
                <td className={tdClass}>{formatDate(l.journalEntry.date)}</td>
                <td className={tdClass}>{l.memo || l.journalEntry.memo || "-"}</td>
                <td className={tdClass}>{Number(l.debit) ? `$${formatMoney(l.debit.toString())}` : ""}</td>
                <td className={tdClass}>{Number(l.credit) ? `$${formatMoney(l.credit.toString())}` : ""}</td>
                <td className={tdClass}>${formatMoney(balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={5}>
                  No activity for this account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
