import { createParty } from "@/lib/actions/parties";
import { buttonClass, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export default function NewPartyPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Customer / Vendor</h1>
      <form action={createParty} className={`${cardClass} space-y-4`}>
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select name="type" required className={selectClass} defaultValue="CUSTOMER">
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input name="phone" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <textarea name="address" rows={2} className={inputClass} />
        </div>
        <button type="submit" className={buttonClass}>
          Create
        </button>
      </form>
    </div>
  );
}
