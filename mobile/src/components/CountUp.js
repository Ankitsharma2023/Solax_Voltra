import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

// Animates a number from its previous value to the new one (like the SolaX app's ticking values).
export default function CountUp({ value, digits = 2, duration = 700, style }) {
  const [shown, setShown] = useState(Number(value) || 0);
  const from = useRef(Number(value) || 0);

  useEffect(() => {
    const to = Number(value);
    if (Number.isNaN(to)) return undefined;
    const start = Date.now(), a = from.current;
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setShown(a + (to - a) * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text style={style}>{value == null || Number.isNaN(Number(value)) ? '--' : shown.toFixed(digits)}</Text>;
}
