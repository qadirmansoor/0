import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonClass, cardClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function PartiesPage() {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Customers &amp; Vendors</h1>
        <Link href="/parties/new" className={buttonClass}>
          New Party
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parties.map((p) => (
              <tr key={p.id}>
                <td className={tdClass}>{p.name}</td>
                <td className={tdClass}>{p.type}</td>
                <td className={tdClass}>{p.email || "-"}</td>
                <td className={tdClass}>{p.phone || "-"}</td>
                <td className={tdClass}>{p.isActive ? "Active" : "Inactive"}</td>
                <td className={tdClass}>
                  <Link href={`/parties/${p.id}`} className="text-slate-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {parties.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={6}>
                  No customers or vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
