import { AnimatedCounter } from './AnimatedCounter';

const iconMap = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.8-6 4v2h12v-2c0-2.2-2.7-4-6-4Zm8 0c-.6 0-1.2.1-1.8.2 1.1 1 1.8 2.3 1.8 3.8v2h8v-2c0-2.2-2.7-4-6-4Z" fill="currentColor" />
    </svg>
  ),
  active: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3 2 9l10 6 10-6-10-6Zm0 9L2 6v12l10 6 10-6V6l-10 6Z" fill="currentColor" />
    </svg>
  ),
  time: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v6l5 3 1-1.7-4-2.3V7Z" fill="currentColor" />
    </svg>
  ),
  bounce: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 4h16v2H4V4Zm0 7h8v2H4v-2Zm0 7h16v2H4v-2Zm13.3-8.3L20 12l-2.7 2.3-1.3-1.6L17 12l-1-1.1 1.3-1.2Z" fill="currentColor" />
    </svg>
  ),
  retention: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2 4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4Zm-1 14-4-4 1.4-1.4 2.6 2.6 4.6-4.6L17 10l-6 6Z" fill="currentColor" />
    </svg>
  ),
  score: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-9 9h2a7 7 0 1 1 14 0h2a9 9 0 0 0-9-9Zm-1 9 6-3-3 6h-3v-3Z" fill="currentColor" />
    </svg>
  )
};

export function StatCard({ title, value, subtitle, icon = 'score', suffix = '', decimals = 0, trend }) {
  const showTrend = typeof trend?.value === 'number' && Number.isFinite(trend.value);
  const positive = trend?.value >= 0;

  return (
    <div className="glass-panel hover-lift enter-up group rounded-2xl p-5 shadow-soft transition hover:shadow-xl hover:shadow-brand-500/10">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{title}</p>
        <span className="rounded-lg bg-brand-100 p-2 text-brand-700 transition group-hover:scale-105 dark:bg-brand-900/40 dark:text-brand-200">
          {iconMap[icon] || iconMap.score}
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        <AnimatedCounter value={value} decimals={decimals} suffix={suffix} />
      </p>
      {showTrend ? (
        <p
          className={`mt-2 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
            positive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
          }`}
        >
          {positive ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}% vs previous period
        </p>
      ) : null}
      {subtitle ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
