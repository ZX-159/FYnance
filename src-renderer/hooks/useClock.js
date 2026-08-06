// hooks/useClock.js — live ticking clock (1s), drives time-aware greeting too.
import { useEffect, useState } from 'react';

export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Time-of-day greeting key: good_morning / good_afternoon / good_evening */
export function greetingKey(date) {
  const h = (date || new Date()).getHours();
  return h < 12 ? 'good_morning' : h < 18 ? 'good_afternoon' : 'good_evening';
}

/** "14:32:05" (HH:MM:SS) */
export function clockHMS(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** "Friday, 6 August" */
export function clockDate(date) {
  try {
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}
