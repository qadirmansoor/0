import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonClass, cardClass, formatDate, formatMoney, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function JournalPage() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { date: "desc" },
    include: { lines: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Journal Entries</h1>
        <Link href="/accounts/journal/new" className={buttonClass}>
          New Journal Entry
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Memo</th>
              <th className={thClass}>Source</th>
              <th className={thClass}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => {
              const total = e.lines.reduce((s, l) => s + Number(l.debit), 0);
              return (
                <tr key={e.id}>
                  <td className={tdClass}>{formatDate(e.date)}</td>
                  <td className={tdClass}>{e.memo || "-"}</td>
                  <td className={tdClass}>{e.source}</td>
                  <td className={tdClass}>${formatMoney(total)}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={4}>
                  No journal entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
