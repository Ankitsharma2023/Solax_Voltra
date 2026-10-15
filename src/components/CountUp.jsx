import { useEffect, useRef, useState } from 'react';

// Animates a number from its previous value to the new one (like the SolaX app's ticking values).
export default function CountUp({ value, digits = 2, duration = 700 }) {
  const [shown, setShown] = useState(Number(value) || 0);
  const from = useRef(Number(value) || 0);

  useEffect(() => {
    const to = Number(value);
    if (Number.isNaN(to)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(to); from.current = to; return; }
    const start = performance.now(), a = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(a + (to - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (value == null || Number.isNaN(Number(value))) return '--';
  return shown.toFixed(digits);
}
