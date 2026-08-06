import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useClock, clockHMS } from '../hooks/useClock';
import ThemeSwitch from './ThemeSwitch';
import Notifications from './Notifications';

export default function Topbar({
  title, eyebrow, appState, data, theme = 'system', onToggleTheme, onSync, onSearch,
}) {
  const { t, timeAgo } = useI18n();
  const { status, lastSync, error } = appState;
  const now = useClock();
  const [q, setQ] = useState('');

  // effective scheme for the toggle's on/off state (checked = light)
  const effective =
    theme === 'dark' || theme === 'light'
      ? theme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const isDark = effective === 'dark';

  const pillText =
    status === 'syncing' ? t('syncing')
    : status === 'error' ? t('sync_failed')
    : status === 'ok' ? t('synced')
    : t('idle');

  const signalsBlock = (
    <Notifications appState={appState} data={data} />
  );

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) {
      onSearch(q.trim());
      setQ('');
    }
  };

  return (
    <header className="topbar">
      <div className="page-identity">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <form className="global-search" onSubmit={submit}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_workspace')} aria-label={t('search_workspace')} />
          <kbd>⌘ K</kbd>
        </form>

        <div className="clock-chip" title={now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
          <span className="clock-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </span>
          {clockHMS(now).slice(0, 5)}<span className="clock-sec">:{clockHMS(now).slice(6)}</span>
        </div>

        <div className="status-pill" data-status={status}>
          <i />
          {pillText}
        </div>

        <ThemeSwitch checked={!isDark} onChange={onToggleTheme} />

        {signalsBlock}

        <button className="sync-button" onClick={() => onSync()} disabled={status === 'syncing'}>
          <svg className={status === 'syncing' ? 'spin' : ''} viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          {status === 'syncing' ? t('syncing') : t('sync_now')}
        </button>
      </div>
    </header>
  );
}
