import { prisma } from "@/lib/prisma";
import { createInvoice } from "@/lib/actions/invoices";
import { DocumentLinesEditor } from "@/components/document-lines-editor";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default async function NewInvoicePage() {
  const [customers, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: { type: { in: ["CUSTOMER", "BOTH"] }, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const itemOptions = items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, unitPrice: Number(i.salePrice) }));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Invoice</h1>
      <form action={createInvoice} className={`${cardClass} space-y-4`}>
        <div className="grid grid-cols-3 gap-4">
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
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" name="dueDate" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Ship From Warehouse (only needed if selling tracked items)
          </label>
          <select name="warehouseId" className={selectClass} defaultValue="">
            <option value="">None (service / no stock impact)</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <DocumentLinesEditor items={itemOptions} />

        <button type="submit" className={buttonClass}>
          Create Invoice
        </button>
      </form>
    </div>
  );
}
