import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast';

export default function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      if (t.dismiss) {
        setItems((xs) => xs.filter((x) => x.id !== t.id));
        // trigger the exit animation then remove
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id && !x.out)), 10);
        setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, out: true } : x)));
      } else {
        setItems((xs) => [...xs, t]);
      }
    });
  }, []);

  return (
    <div className="toast-stack">
      {items
        .filter((t) => !t.dismiss)
        .map((t, i) => (
          <div
            key={t.id}
            className={`toast ${t.out ? 'out' : ''}`}
            data-kind={t.kind}
            style={{ animationDelay: `${Math.min(i, 3) * 70}ms` }}
          >
            {t.message}
          </div>
        ))}
    </div>
  );
}
