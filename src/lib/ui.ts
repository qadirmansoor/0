export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
export const selectClass = inputClass;
export const labelClass = "mb-1 block text-sm font-medium text-slate-700";
export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
export const dangerButtonClass =
  "inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500";
export const cardClass = "rounded-lg border border-slate-200 bg-white p-6 shadow-sm";
export const tableClass = "min-w-full divide-y divide-slate-200 text-sm";
export const thClass = "px-4 py-2 text-left font-medium text-slate-500";
export const tdClass = "px-4 py-2 text-slate-800";
export const badgeClass = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function badgeColor(status: string) {
  switch (status) {
    case "PAID":
    case "CLOSED":
      return "bg-green-100 text-green-800";
    case "OPEN":
      return "bg-blue-100 text-blue-800";
    case "PARTIAL":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function formatMoney(n: number | string) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return (num || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
