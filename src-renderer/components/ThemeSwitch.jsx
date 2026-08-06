// components/ThemeSwitch.jsx — the GENERAL dark/light toggle (mrhyddenn-style).
// Used in the topbar (and sidebar) — a clean white slider that turns green
// when "on" (light mode). Settings' behaviour toggles keep their own style.

import { useI18n } from '../lib/i18n';

export default function ThemeSwitch({ checked, onChange }) {
  const { t } = useI18n();
  return (
    <label className="theme-switch" title={checked ? t('dark_mode') : t('light_mode')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={t('appearance')}
      />
      <span className="slider" />
      <span className="decoration" />
    </label>
  );
}
