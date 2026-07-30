import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonClass, cardClass, formatMoney, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    orderBy: { sku: "asc" },
    include: { stockLevels: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Items</h1>
        <Link href="/inventory/items/new" className={buttonClass}>
          New Item
        </Link>
      </div>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>SKU</th>
              <th className={thClass}>Name</th>
              <th className={thClass}>Cost</th>
              <th className={thClass}>Sale Price</th>
              <th className={thClass}>On Hand</th>
              <th className={thClass}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const onHand = item.stockLevels.reduce((s, l) => s + Number(l.quantity), 0);
              return (
                <tr key={item.id}>
                  <td className={tdClass}>{item.sku}</td>
                  <td className={tdClass}>{item.name}</td>
                  <td className={tdClass}>${formatMoney(item.costPrice.toString())}</td>
                  <td className={tdClass}>${formatMoney(item.salePrice.toString())}</td>
                  <td className={tdClass}>
                    {formatMoney(onHand)} {item.unit}
                  </td>
                  <td className={tdClass}>{item.isActive ? "Active" : "Inactive"}</td>
                  <td className={tdClass}>
                    <Link href={`/inventory/items/${item.id}`} className="text-slate-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={7}>
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
