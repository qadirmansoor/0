import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { badgeClass, badgeColor, buttonClass, cardClass, formatDate, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function SalesOrdersPage() {
  const orders = await prisma.salesOrder.findMany({
    orderBy: { date: "desc" },
    include: { customer: true, lines: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Sales Orders</h1>
        <Link href="/sales-orders/new" className={buttonClass}>
          New Sales Order
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Number</th>
              <th className={thClass}>Customer</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Lines</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={tdClass}>
                  <Link href={`/sales-orders/${o.id}`} className="text-slate-900 hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className={tdClass}>{o.customer.name}</td>
                <td className={tdClass}>{formatDate(o.date)}</td>
                <td className={tdClass}>{o.lines.length}</td>
                <td className={tdClass}>
                  <span className={`${badgeClass} ${badgeColor(o.status)}`}>{o.status}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={5}>
                  No sales orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
