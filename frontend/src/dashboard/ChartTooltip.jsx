export function ChartTooltip({ active, payload, label, valueSuffix = '', title }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur">
      <p className="mb-1 font-semibold text-slate-200">{title || label}</p>
      {label && title ? <p className="mb-1 text-[11px] text-slate-400">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-slate-100">
              {entry.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
