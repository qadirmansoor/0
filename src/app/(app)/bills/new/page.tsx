import { prisma } from "@/lib/prisma";
import { createBill } from "@/lib/actions/bills";
import { DocumentLinesEditor } from "@/components/document-lines-editor";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default async function NewBillPage() {
  const [vendors, items, warehouses] = await Promise.all([
    prisma.party.findMany({ where: { type: { in: ["VENDOR", "BOTH"] }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const itemOptions = items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, unitPrice: Number(i.costPrice) }));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Bill</h1>
      <form action={createBill} className={`${cardClass} space-y-4`}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Vendor</label>
            <select name="vendorId" required className={selectClass}>
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
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
            Receiving Warehouse (only needed if buying tracked items)
          </label>
          <select name="warehouseId" className={selectClass} defaultValue="">
            <option value="">None (expense / no stock impact)</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <DocumentLinesEditor items={itemOptions} />

        <button type="submit" className={buttonClass}>
          Create Bill
        </button>
      </form>
    </div>
  );
}
