import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { receivePurchaseOrder } from "@/lib/actions/purchase-orders";
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

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [po, warehouses] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true, lines: { include: { item: true } }, bills: true },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!po) notFound();

  const receiveWithId = receivePurchaseOrder.bind(null, po.id);
  const total = po.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{po.number}</h1>
        <span className={`${badgeClass} ${badgeColor(po.status)}`}>{po.status}</span>
      </div>

      <div className={cardClass}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Vendor</p>
            <p className="font-medium text-slate-900">{po.vendor.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Date</p>
            <p className="font-medium text-slate-900">{formatDate(po.date)}</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={thClass}>Qty</th>
              <th className={thClass}>Received</th>
              <th className={thClass}>Unit Price</th>
              <th className={thClass}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {po.lines.map((l) => (
              <tr key={l.id}>
                <td className={tdClass}>
                  {l.item.sku} - {l.item.name}
                </td>
                <td className={tdClass}>{formatMoney(l.quantity.toString())}</td>
                <td className={tdClass}>{formatMoney(l.quantityReceived.toString())}</td>
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

      {po.status !== "CLOSED" && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Receive Goods &amp; Create Bill</h2>
          <form action={receiveWithId} className="flex items-end gap-4">
            <div className="flex-1">
              <label className={labelClass}>Receiving Warehouse</label>
              <select name="warehouseId" required className={selectClass}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonClass}>
              Receive All &amp; Bill
            </button>
          </form>
        </div>
      )}

      {po.bills.length > 0 && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Related Bills</h2>
          <ul className="space-y-1 text-sm">
            {po.bills.map((b) => (
              <li key={b.id}>
                <Link href={`/bills/${b.id}`} className="text-slate-600 hover:underline">
                  {b.number}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
