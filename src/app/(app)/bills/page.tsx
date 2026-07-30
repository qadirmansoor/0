import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { badgeClass, badgeColor, buttonClass, cardClass, formatDate, formatMoney, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function BillsPage() {
  const bills = await prisma.bill.findMany({
    orderBy: { date: "desc" },
    include: { vendor: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Bills</h1>
        <Link href="/bills/new" className={buttonClass}>
          New Bill
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Number</th>
              <th className={thClass}>Vendor</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Total</th>
              <th className={thClass}>Paid</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bills.map((b) => (
              <tr key={b.id}>
                <td className={tdClass}>
                  <Link href={`/bills/${b.id}`} className="text-slate-900 hover:underline">
                    {b.number}
                  </Link>
                </td>
                <td className={tdClass}>{b.vendor.name}</td>
                <td className={tdClass}>{formatDate(b.date)}</td>
                <td className={tdClass}>${formatMoney(b.total.toString())}</td>
                <td className={tdClass}>${formatMoney(b.amountPaid.toString())}</td>
                <td className={tdClass}>
                  <span className={`${badgeClass} ${badgeColor(b.status)}`}>{b.status}</span>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={6}>
                  No bills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
