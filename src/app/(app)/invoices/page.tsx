import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { badgeClass, badgeColor, buttonClass, cardClass, formatDate, formatMoney, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { date: "desc" },
    include: { customer: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <Link href="/invoices/new" className={buttonClass}>
          New Invoice
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Number</th>
              <th className={thClass}>Customer</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Total</th>
              <th className={thClass}>Paid</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className={tdClass}>
                  <Link href={`/invoices/${inv.id}`} className="text-slate-900 hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td className={tdClass}>{inv.customer.name}</td>
                <td className={tdClass}>{formatDate(inv.date)}</td>
                <td className={tdClass}>${formatMoney(inv.total.toString())}</td>
                <td className={tdClass}>${formatMoney(inv.amountPaid.toString())}</td>
                <td className={tdClass}>
                  <span className={`${badgeClass} ${badgeColor(inv.status)}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={6}>
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
