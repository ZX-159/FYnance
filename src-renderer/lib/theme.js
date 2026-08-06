// lib/theme.js — theme resolution (dark/light/system).

export function applyTheme(theme, family = 'fynance') {
  const resolved =
    theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
  document.documentElement.dataset.scheme = resolved;
  document.documentElement.dataset.family = family;
  // native controls (scrollbars, inputs, dialogs) follow the same scheme
  document.documentElement.style.colorScheme = resolved;
}

export function watchSystemTheme(cb) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const fn = () => cb(mq.matches ? 'dark' : 'light');
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
