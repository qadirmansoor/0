import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateParty } from "@/lib/actions/parties";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default async function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) notFound();

  const updateWithId = updateParty.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Edit {party.name}</h1>
      <form action={updateWithId} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" defaultValue={party.name} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <input value={party.type} disabled className={`${inputClass} bg-slate-50`} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" defaultValue={party.email ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input name="phone" defaultValue={party.phone ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <textarea name="address" rows={2} defaultValue={party.address ?? ""} className={inputClass} />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={party.isActive}
            className="h-4 w-4"
          />
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
