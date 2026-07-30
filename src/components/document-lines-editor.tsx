"use client";

import { useState } from "react";
import { inputClass, secondaryButtonClass, selectClass } from "@/lib/ui";

type Item = { id: string; sku: string; name: string; unitPrice: number };

export function DocumentLinesEditor({ items }: { items: Item[] }) {
  const [rows, setRows] = useState([0]);
  const [nextId, setNextId] = useState(1);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500">
        <div className="col-span-3">Item (optional)</div>
        <div className="col-span-3">Description</div>
        <div className="col-span-2">Quantity</div>
        <div className="col-span-2">Unit Price</div>
      </div>
      {rows.map((rowId) => (
        <div key={rowId} className="grid grid-cols-12 gap-2">
          <select
            name="lineItemId"
            className={`${selectClass} col-span-3`}
            onChange={(e) => {
              const item = itemsById.get(e.target.value);
              const row = e.currentTarget.closest(".grid");
              const descInput = row?.querySelector<HTMLInputElement>('input[name="lineDescription"]');
              const priceInput = row?.querySelector<HTMLInputElement>('input[name="lineUnitPrice"]');
              if (item) {
                if (descInput && !descInput.value) descInput.value = item.name;
                if (priceInput) priceInput.value = String(item.unitPrice);
              }
            }}
          >
            <option value="">None</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} - {i.name}
              </option>
            ))}
          </select>
          <input name="lineDescription" required className={`${inputClass} col-span-3`} />
          <input
            type="number"
            step="0.01"
            min="0"
            name="lineQuantity"
            defaultValue="1"
            className={`${inputClass} col-span-2`}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            name="lineUnitPrice"
            defaultValue="0"
            className={`${inputClass} col-span-2`}
            required
          />
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
