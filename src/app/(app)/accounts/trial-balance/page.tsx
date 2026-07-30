import { prisma } from "@/lib/prisma";
import { cardClass, formatMoney, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function TrialBalancePage() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: "asc" },
    include: { lines: true },
  });

  const rows = accounts
    .map((a) => {
      const debit = a.lines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = a.lines.reduce((s, l) => s + Number(l.credit), 0);
      const net = debit - credit;
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        debitBalance: Math.max(net, 0),
        creditBalance: Math.max(-net, 0),
      };
    })
    .filter((r) => r.debitBalance !== 0 || r.creditBalance !== 0);

  const totalDebit = rows.reduce((s, r) => s + r.debitBalance, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Trial Balance</h1>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Code</th>
              <th className={thClass}>Account</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Debit</th>
              <th className={thClass}>Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={tdClass}>{r.code}</td>
                <td className={tdClass}>{r.name}</td>
                <td className={tdClass}>{r.type}</td>
                <td className={tdClass}>{r.debitBalance ? `$${formatMoney(r.debitBalance)}` : ""}</td>
                <td className={tdClass}>{r.creditBalance ? `$${formatMoney(r.creditBalance)}` : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={tdClass} colSpan={3}>
                Total
              </td>
              <td className={tdClass}>${formatMoney(totalDebit)}</td>
              <td className={tdClass}>${formatMoney(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
        {Math.abs(totalDebit - totalCredit) > 0.01 && (
          <p className="mt-3 text-sm text-red-600">
            Warning: trial balance is out of balance by ${formatMoney(Math.abs(totalDebit - totalCredit))}.
          </p>
        )}
      </div>
    </div>
  );
}
