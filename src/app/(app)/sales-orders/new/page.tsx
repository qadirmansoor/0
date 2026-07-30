import { prisma } from "@/lib/prisma";
import { createSalesOrder } from "@/lib/actions/sales-orders";
import { OrderLinesEditor } from "@/components/order-lines-editor";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default async function NewSalesOrderPage() {
  const [customers, items] = await Promise.all([
    prisma.party.findMany({
      where: { type: { in: ["CUSTOMER", "BOTH"] }, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
  ]);

  const itemOptions = items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, unitPrice: Number(i.salePrice) }));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Sales Order</h1>
      <form action={createSalesOrder} className={`${cardClass} space-y-4`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Customer</label>
            <select name="customerId" required className={selectClass}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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
        </div>

        <OrderLinesEditor items={itemOptions} />

        <button type="submit" className={buttonClass}>
          Create Sales Order
        </button>
      </form>
    </div>
  );
}
