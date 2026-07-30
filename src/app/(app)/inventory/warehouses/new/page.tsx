import { createWarehouse } from "@/lib/actions/inventory";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default function NewWarehousePage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Warehouse</h1>
      <form action={createWarehouse} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input name="location" className={inputClass} />
        </div>
        <button type="submit" className={buttonClass}>
          Create
        </button>
      </form>
    </div>
  );
}
