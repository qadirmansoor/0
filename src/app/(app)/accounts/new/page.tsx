import { prisma } from "@/lib/prisma";
import { createAccount } from "@/lib/actions/accounts";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default async function NewAccountPage() {
  const parents = await prisma.account.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Account</h1>
      <form action={createAccount} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Code</label>
          <input name="code" required className={inputClass} placeholder="e.g. 1300" />
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select name="type" required className={selectClass} defaultValue="ASSET">
            <option value="ASSET">Asset</option>
            <option value="LIABILITY">Liability</option>
            <option value="EQUITY">Equity</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Parent Account (optional)</label>
          <select name="parentId" className={selectClass} defaultValue="">
            <option value="">None</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass}>
          Create Account
        </button>
      </form>
    </div>
  );
}
