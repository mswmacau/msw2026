'use client';

import { useEffect, useRef, useState } from 'react';

export function Counter({
  value,
  duration = 1400,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 保險：動畫若因任何原因未啟動（爬蟲、舊瀏覽器），1.5 秒後直接顯示最終值
    const fallback = setTimeout(() => setN(value), 1500);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        clearTimeout(fallback);
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(value * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
