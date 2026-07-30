import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/actions/inventory";
import { buttonClass, cardClass, formatMoney, inputClass, labelClass, selectClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function StockPage() {
  const [stockLevels, items, warehouses] = await Promise.all([
    prisma.stockLevel.findMany({
      include: { item: true, warehouse: true },
      orderBy: [{ item: { sku: "asc" } }],
    }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Stock Levels</h1>

      <div className={cardClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={thClass}>Warehouse</th>
              <th className={thClass}>Quantity</th>
              <th className={thClass}>Reorder Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stockLevels.map((s) => (
              <tr key={s.id} className={Number(s.quantity) <= Number(s.item.reorderLevel) ? "bg-amber-50" : ""}>
                <td className={tdClass}>
                  {s.item.sku} - {s.item.name}
                </td>
                <td className={tdClass}>{s.warehouse.name}</td>
                <td className={tdClass}>
                  {formatMoney(s.quantity.toString())} {s.item.unit}
                </td>
                <td className={tdClass}>{formatMoney(s.item.reorderLevel.toString())}</td>
              </tr>
            ))}
            {stockLevels.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={4}>
                  No stock recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Adjust Stock</h2>
        <form action={adjustStock} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <label className={labelClass}>Item</label>
            <select name="itemId" required className={selectClass}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Warehouse</label>
            <select name="warehouseId" required className={selectClass}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Quantity (+/-)</label>
            <input type="number" step="0.01" name="quantity" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Reference</label>
            <input name="reference" className={inputClass} />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className={buttonClass}>
              Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
