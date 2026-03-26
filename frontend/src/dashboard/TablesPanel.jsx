import { EmptyState } from './EmptyState';

function SimpleTable({ title, columns, rows }) {
  return (
    <div className="glass-panel hover-lift enter-up rounded-2xl p-5 shadow-soft transition hover:shadow-xl hover:shadow-brand-500/10">
      <h3 className="mb-4 text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {columns.map((col) => (
                <th key={col} className="px-2 py-2 font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 transition hover:bg-white/70 dark:border-slate-800 dark:hover:bg-slate-800/45">
                  {Object.values(row).map((value, cellIdx) => (
                    <td key={cellIdx} className="px-2 py-2 text-slate-700 dark:text-slate-200">{String(value ?? '-')}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-4 text-slate-500 dark:text-slate-400" colSpan={columns.length}>
                  No data for this range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TablesPanel({ eventsData }) {
  const recent = (eventsData?.recentActivityLogs || []).map((row) => ({
    time: new Date(row.occurredAt).toLocaleString(),
    event: row.eventType,
    page: row.page,
    feature: row.feature || '-',
    element: row.element || '-'
  }));

  const topPages = (eventsData?.topPages || []).map((row) => ({ page: row.page, visits: row.visits }));
  const topElements = (eventsData?.mostClickedElements || []).map((row) => ({ element: row.element, clicks: row.clicks }));

  if (!recent.length && !topPages.length && !topElements.length) {
    return <EmptyState title="No activity logs found" subtitle="As users interact with your app, tables will populate automatically." />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <SimpleTable title="Recent Activity Logs" columns={['Time', 'Event', 'Page', 'Feature', 'Element']} rows={recent} />
      <SimpleTable title="Top Performing Pages" columns={['Page', 'Visits']} rows={topPages} />
      <SimpleTable title="Most Clicked Elements" columns={['Element', 'Clicks']} rows={topElements} />
    </div>
  );
}
