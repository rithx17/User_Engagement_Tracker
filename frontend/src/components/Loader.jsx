export function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="glass-panel rounded-2xl px-6 py-4 text-sm text-slate-600 shadow-soft dark:text-slate-300">
        {label}
      </div>
    </div>
  );
}
