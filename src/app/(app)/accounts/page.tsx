import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonClass, cardClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });

  const byType = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Chart of Accounts</h1>
        <Link href="/accounts/new" className={buttonClass}>
          New Account
        </Link>
      </div>

      {Object.entries(byType).map(([type, list]) => (
        <div key={type} className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{type}</h2>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Code</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Status</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a) => (
                <tr key={a.id}>
                  <td className={tdClass}>{a.code}</td>
                  <td className={tdClass}>{a.name}</td>
                  <td className={tdClass}>{a.isActive ? "Active" : "Inactive"}</td>
                  <td className={tdClass}>
                    <Link href={`/accounts/${a.id}`} className="text-slate-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
