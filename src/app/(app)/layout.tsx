import Link from "next/link";
import { auth, signOut } from "@/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { section: "Accounts" },
  { href: "/accounts", label: "Chart of Accounts" },
  { href: "/accounts/journal", label: "Journal Entries" },
  { href: "/accounts/ledger", label: "General Ledger" },
  { href: "/accounts/trial-balance", label: "Trial Balance" },
  { href: "/parties", label: "Customers & Vendors" },
  { href: "/invoices", label: "Invoices" },
  { href: "/bills", label: "Bills" },
  { section: "Inventory" },
  { href: "/inventory/items", label: "Items" },
  { href: "/inventory/warehouses", label: "Warehouses" },
  { href: "/inventory/stock", label: "Stock Levels" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/sales-orders", label: "Sales Orders" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="text-lg font-semibold text-slate-900">ERP</h1>
          <p className="text-xs text-slate-500">Accounts &amp; Inventory</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 py-4">
          {NAV.map((item, i) =>
            "section" in item ? (
              <div
                key={`section-${i}`}
                className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0"
              >
                {item.section}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session?.user?.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
