import { useEffect, useMemo, useState } from 'react';

export function AnimatedCounter({ value, duration = 700, decimals = 0, suffix = '' }) {
  const numericValue = useMemo(() => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [value]);

  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = numericValue;

    let raf;
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numericValue]);

  return (
    <span>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
