import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateAccount } from "@/lib/actions/accounts";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) notFound();

  const updateWithId = updateAccount.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Edit Account {account.code}
      </h1>
      <form action={updateWithId} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Code</label>
          <input value={account.code} disabled className={`${inputClass} bg-slate-50`} />
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" defaultValue={account.name} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <input value={account.type} disabled className={`${inputClass} bg-slate-50`} />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={account.isActive}
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
