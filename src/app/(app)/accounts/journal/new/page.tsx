import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "@/lib/actions/accounts";
import { JournalLinesEditor } from "@/components/journal-lines-editor";
import { buttonClass, cardClass, inputClass, labelClass } from "@/lib/ui";

export default async function NewJournalEntryPage() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Journal Entry</h1>
      <form action={createJournalEntry} className={`${cardClass} space-y-4`}>
        <div className="grid grid-cols-2 gap-4">
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
            <label className={labelClass}>Reference</label>
            <input name="reference" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Memo</label>
          <input name="memo" className={inputClass} />
        </div>

        <JournalLinesEditor accounts={accounts} />

        <p className="text-xs text-slate-500">
          Total debits must equal total credits for the entry to be saved.
        </p>

        <button type="submit" className={buttonClass}>
          Save Journal Entry
        </button>
      </form>
    </div>
  );
}
