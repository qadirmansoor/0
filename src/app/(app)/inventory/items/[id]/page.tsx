import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateItem } from "@/lib/actions/inventory";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) notFound();

  const updateWithId = updateItem.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Edit {item.sku}</h1>
      <form action={updateWithId} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" defaultValue={item.name} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea name="description" rows={2} defaultValue={item.description ?? ""} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Unit</label>
            <input name="unit" defaultValue={item.unit} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Reorder Level</label>
            <input
              type="number"
              step="0.01"
              name="reorderLevel"
              defaultValue={item.reorderLevel.toString()}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cost Price</label>
            <input
              type="number"
              step="0.01"
              name="costPrice"
              defaultValue={item.costPrice.toString()}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sale Price</label>
            <input
              type="number"
              step="0.01"
              name="salePrice"
              defaultValue={item.salePrice.toString()}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isActive" name="isActive" defaultChecked={item.isActive} className="h-4 w-4" />
          <label htmlFor="isActive" className="text-sm text-slate-700">
            Active
          </label>
        </div>
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>
    </div>
  );
}
