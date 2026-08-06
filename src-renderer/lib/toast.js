// lib/toast.js — tiny pub/sub toast system (no context needed).

let listeners = [];

export function toast(message, kind = 'info', ms = 4200) {
  const id = Date.now() + Math.random();
  listeners.forEach((l) => l({ id, message, kind }));
  setTimeout(() => {
    listeners.forEach((l) => l({ id, message, kind, dismiss: true }));
  }, ms);
}

export function subscribeToasts(cb) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
