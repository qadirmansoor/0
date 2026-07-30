import { prisma } from "@/lib/prisma";
import { createPurchaseOrder } from "@/lib/actions/purchase-orders";
import { OrderLinesEditor } from "@/components/order-lines-editor";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default async function NewPurchaseOrderPage() {
  const [vendors, items] = await Promise.all([
    prisma.party.findMany({ where: { type: { in: ["VENDOR", "BOTH"] }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
  ]);

  const itemOptions = items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, unitPrice: Number(i.costPrice) }));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Purchase Order</h1>
      <form action={createPurchaseOrder} className={`${cardClass} space-y-4`}>
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <OrderLinesEditor items={itemOptions} />

        <button type="submit" className={buttonClass}>
          Create Purchase Order
        </button>
      </form>
    </div>
  );
}
