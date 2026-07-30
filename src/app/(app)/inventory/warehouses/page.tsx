import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonClass, cardClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function WarehousesPage() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Warehouses</h1>
        <Link href="/inventory/warehouses/new" className={buttonClass}>
          New Warehouse
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Location</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td className={tdClass}>{w.name}</td>
                <td className={tdClass}>{w.location || "-"}</td>
                <td className={tdClass}>{w.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={3}>
                  No warehouses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
