export function EmptyState({ title = 'No data available', subtitle = 'Try a different date range or refresh.' }) {
  return (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-200/70 dark:bg-slate-700/60" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}
