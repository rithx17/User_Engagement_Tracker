export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton glass-panel h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton glass-panel h-80 rounded-2xl" />
      ))}
    </div>
  );
}

export function TablesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton glass-panel h-72 rounded-2xl" />
      ))}
    </div>
  );
}
