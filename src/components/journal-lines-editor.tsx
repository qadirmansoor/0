"use client";

import { useState } from "react";
import { inputClass, secondaryButtonClass, selectClass } from "@/lib/ui";

type Account = { id: string; code: string; name: string };

export function JournalLinesEditor({ accounts }: { accounts: Account[] }) {
  const [rows, setRows] = useState([0, 1]);
  const [nextId, setNextId] = useState(2);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500">
        <div className="col-span-4">Account</div>
        <div className="col-span-3">Debit</div>
        <div className="col-span-3">Credit</div>
        <div className="col-span-2">Memo</div>
      </div>
      {rows.map((rowId) => (
        <div key={rowId} className="grid grid-cols-12 gap-2">
          <select name="lineAccountId" className={`${selectClass} col-span-4`} required>
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            name="lineDebit"
            defaultValue="0"
            className={`${inputClass} col-span-3`}
          />
          <input
            type="number"
            step="0.01"
            name="lineCredit"
            defaultValue="0"
            className={`${inputClass} col-span-3`}
          />
          <input name="lineMemo" className={`${inputClass} col-span-2`} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((r) => [...r, nextId]);
          setNextId((n) => n + 1);
        }}
        className={secondaryButtonClass}
      >
        Add Line
      </button>
    </div>
  );
}
