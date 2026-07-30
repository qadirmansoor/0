import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordBillPayment } from "@/lib/actions/payments";
import {
  badgeClass,
  badgeColor,
  buttonClass,
  cardClass,
  formatDate,
  formatMoney,
  inputClass,
  labelClass,
  selectClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { vendor: true, lines: true, payments: true },
  });
  if (!bill) notFound();

  const recordPaymentWithId = recordBillPayment.bind(null, bill.id);
  const balance = Number(bill.total) - Number(bill.amountPaid);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{bill.number}</h1>
        <span className={`${badgeClass} ${badgeColor(bill.status)}`}>{bill.status}</span>
      </div>

      <div className={cardClass}>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Vendor</p>
            <p className="font-medium text-slate-900">{bill.vendor.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Date</p>
            <p className="font-medium text-slate-900">{formatDate(bill.date)}</p>
          </div>
          <div>
            <p className="text-slate-500">Due</p>
            <p className="font-medium text-slate-900">{bill.dueDate ? formatDate(bill.dueDate) : "-"}</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Description</th>
              <th className={thClass}>Qty</th>
              <th className={thClass}>Unit Price</th>
              <th className={thClass}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bill.lines.map((l) => (
              <tr key={l.id}>
                <td className={tdClass}>{l.description}</td>
                <td className={tdClass}>{formatMoney(l.quantity.toString())}</td>
                <td className={tdClass}>${formatMoney(l.unitPrice.toString())}</td>
                <td className={tdClass}>${formatMoney(l.amount.toString())}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={tdClass} colSpan={3}>
                Total
              </td>
              <td className={tdClass}>${formatMoney(bill.total.toString())}</td>
            </tr>
            <tr>
              <td className={tdClass} colSpan={3}>
                Paid
              </td>
              <td className={tdClass}>${formatMoney(bill.amountPaid.toString())}</td>
            </tr>
            <tr className="font-semibold">
              <td className={tdClass} colSpan={3}>
                Balance Due
              </td>
              <td className={tdClass}>${formatMoney(balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {balance > 0 && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Record Payment</h2>
          <form action={recordPaymentWithId} className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelClass}>Amount</label>
              <input
                type="number"
                step="0.01"
                name="amount"
                defaultValue={balance.toFixed(2)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Method</label>
              <select name="method" className={selectClass} defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonClass}>
              Record Payment
            </button>
          </form>
        </div>
      )}

      {bill.payments.length > 0 && (
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Payment History</h2>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Method</th>
                <th className={thClass}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className={tdClass}>{formatDate(p.date)}</td>
                  <td className={tdClass}>{p.method}</td>
                  <td className={tdClass}>${formatMoney(p.amount.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
