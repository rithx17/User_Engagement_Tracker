export function DateRangeFilter({ startDate, endDate, onChange }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="text-xs text-slate-500 dark:text-slate-400">
        Start Date
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange({ startDate: e.target.value, endDate })}
          className="mt-1 block rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
        />
      </label>
      <label className="text-xs text-slate-500 dark:text-slate-400">
        End Date
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange({ startDate, endDate: e.target.value })}
          className="mt-1 block rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
        />
      </label>
    </div>
  );
}
