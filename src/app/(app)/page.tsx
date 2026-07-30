import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cardClass, formatMoney } from "@/lib/ui";
import { STANDARD_ACCOUNT_CODES } from "@/lib/accounts-constants";

async function getAccountBalance(code: string) {
  const account = await prisma.account.findUnique({ where: { code }, include: { lines: true } });
  if (!account) return 0;
  const debit = account.lines.reduce((s, l) => s + Number(l.debit), 0);
  const credit = account.lines.reduce((s, l) => s + Number(l.credit), 0);
  return debit - credit;
}

export default async function DashboardPage() {
  const [cash, ar, ap, inventoryValue, itemCount, lowStock, openInvoices, openBills] =
    await Promise.all([
      getAccountBalance(STANDARD_ACCOUNT_CODES.CASH),
      getAccountBalance(STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
      getAccountBalance(STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE).then((v) => -v),
      getAccountBalance(STANDARD_ACCOUNT_CODES.INVENTORY),
      prisma.item.count({ where: { isActive: true } }),
      prisma.stockLevel.findMany({
        include: { item: true, warehouse: true },
        where: { item: { isActive: true } },
      }),
      prisma.invoice.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
      prisma.bill.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
    ]);

  const lowStockItems = lowStock.filter((s) => Number(s.quantity) <= Number(s.item.reorderLevel));

  const cards = [
    { label: "Cash", value: cash, href: "/accounts/ledger" },
    { label: "Accounts Receivable", value: ar, href: "/invoices" },
    { label: "Accounts Payable", value: ap, href: "/bills" },
    { label: "Inventory Value", value: inventoryValue, href: "/inventory/stock" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`${cardClass} block hover:border-slate-300`}>
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">${formatMoney(c.value)}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/inventory/items" className={`${cardClass} block hover:border-slate-300`}>
          <p className="text-sm text-slate-500">Active Items</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{itemCount}</p>
        </Link>
        <Link href="/invoices" className={`${cardClass} block hover:border-slate-300`}>
          <p className="text-sm text-slate-500">Open Invoices</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{openInvoices}</p>
        </Link>
        <Link href="/bills" className={`${cardClass} block hover:border-slate-300`}>
          <p className="text-sm text-slate-500">Open Bills</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{openBills}</p>
        </Link>
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Low Stock Alerts</h2>
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-slate-500">No items below reorder level.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lowStockItems.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {s.item.name} <span className="text-slate-400">({s.warehouse.name})</span>
                </span>
                <span className="font-medium text-amber-700">
                  {formatMoney(s.quantity.toString())} {s.item.unit} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
