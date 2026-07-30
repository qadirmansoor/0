import { createItem } from "@/lib/actions/inventory";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default function NewItemPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Item</h1>
      <form action={createItem} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>SKU</label>
          <input name="sku" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea name="description" rows={2} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Unit</label>
            <input name="unit" defaultValue="EA" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Reorder Level</label>
            <input type="number" step="0.01" name="reorderLevel" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cost Price</label>
            <input type="number" step="0.01" name="costPrice" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sale Price</label>
            <input type="number" step="0.01" name="salePrice" defaultValue="0" className={inputClass} />
          </div>
        </div>
        <button type="submit" className={buttonClass}>
          Create Item
        </button>
      </form>
    </div>
  );
}
