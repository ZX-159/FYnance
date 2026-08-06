// hooks/useAnimatedNumber.js — smooth number tween (easeOutQuart).

import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(value, format = (v) => v, duration = 900) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = Number(prevRef.current) || 0;
    const to = Number(value) || 0;
    prevRef.current = value;
    if (from === to) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * ease(p));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return format(display);
}
