import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fulfillSalesOrder } from "@/lib/actions/sales-orders";
import {
  badgeClass,
  badgeColor,
  buttonClass,
  cardClass,
  formatDate,
  formatMoney,
  labelClass,
  selectClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [so, warehouses] = await Promise.all([
    prisma.salesOrder.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true } }, invoices: true },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!so) notFound();

  const fulfillWithId = fulfillSalesOrder.bind(null, so.id);
  const total = so.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{so.number}</h1>
        <span className={`${badgeClass} ${badgeColor(so.status)}`}>{so.status}</span>
      </div>

      <div className={cardClass}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Customer</p>
            <p className="font-medium text-slate-900">{so.customer.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Date</p>
            <p className="font-medium text-slate-900">{formatDate(so.date)}</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={thClass}>Qty</th>
              <th className={thClass}>Fulfilled</th>
              <th className={thClass}>Unit Price</th>
              <th className={thClass}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {so.lines.map((l) => (
              <tr key={l.id}>
                <td className={tdClass}>
                  {l.item.sku} - {l.item.name}
                </td>
                <td className={tdClass}>{formatMoney(l.quantity.toString())}</td>
                <td className={tdClass}>{formatMoney(l.quantityFulfilled.toString())}</td>
                <td className={tdClass}>${formatMoney(l.unitPrice.toString())}</td>
                <td className={tdClass}>${formatMoney(Number(l.quantity) * Number(l.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={tdClass} colSpan={4}>
                Total
              </td>
              <td className={tdClass}>${formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {so.status !== "CLOSED" && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Fulfill &amp; Create Invoice</h2>
          <form action={fulfillWithId} className="flex items-end gap-4">
            <div className="flex-1">
              <label className={labelClass}>Shipping Warehouse</label>
              <select name="warehouseId" required className={selectClass}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonClass}>
              Fulfill All &amp; Invoice
            </button>
          </form>
        </div>
      )}

      {so.invoices.length > 0 && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Related Invoices</h2>
          <ul className="space-y-1 text-sm">
            {so.invoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="text-slate-600 hover:underline">
                  {inv.number}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
