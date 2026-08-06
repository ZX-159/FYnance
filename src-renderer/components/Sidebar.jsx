import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import ThemeSwitch from './ThemeSwitch';
import { useClock } from '../hooks/useClock';

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const STATUS_KEYS = { idle: 'idle', syncing: 'syncing', ok: 'synced', error: 'sync_failed' };

export default function Sidebar({
  view, onNavigate, status, lastSync, nextSyncAt, balance, activeProfile, profiles,
  onSwitchProfile, onManageAccounts, onToggleTheme, theme,
}) {
  const { t, timeAgo } = useI18n();
  const now = useClock();
  const remaining = nextSyncAt ? Math.max(0, new Date(nextSyncAt).getTime() - now.getTime()) : null;
  const countdown =
    remaining === null ? null
    : remaining < 60000 ? `${Math.ceil(remaining / 1000)}s`
    : `${Math.floor(remaining / 60000)}m ${Math.ceil((remaining % 60000) / 1000)}s`;
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const effective =
    theme === 'dark' || theme === 'light'
      ? theme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const isDark = effective === 'dark';

  const navItems = [
    { key: 'overview', label: t('nav_overview') },
    { key: 'history', label: t('nav_history') },
    { key: 'analytics', label: t('nav_analytics') },
    { key: 'settings', label: t('nav_settings') },
  ];
  const mask = (id) => String(id || '').replace(/\d(?=\d{4})/g, '•') || '—';

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="window-drag">
        <div className="traffic-lights" aria-hidden="true"><i /><i /><i /></div>
        {!collapsed && <span>FYnance</span>}
      </div>

      <div className="brand-row">
        <div className="brand-mark"><span className="brand-fy">FY</span></div>
        {!collapsed && (
          <div className="brand-copy">
            <div className="brand-name">{t('app_name')}</div>
            <span>{t('app_tagline')}</span>
          </div>
        )}
      </div>

      <button className="quick-add" onClick={() => onNavigate('history')} title={t('review_activity')}>
        <span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        {!collapsed && t('review_activity')}
      </button>

      <nav className="side-nav" aria-label="Primary">
        {!collapsed && <p className="nav-label">Workspace</p>}
        {navItems.map((item) => (
          <button
            key={item.key}
            className={view === item.key ? 'active' : ''}
            onClick={() => onNavigate(item.key)}
            title={item.label}
          >
            {ICONS[item.key]}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className={`sync-mini ${status === 'syncing' ? 'syncing' : ''}`}>
          <span className="sync-orbit">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M5 13a7 7 0 0 1 14 0" /><path d="M5 13 2 10M5 13l3-3" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="m19 11-3 3" /></svg>
          </span>
          {!collapsed && (
            <div>
              <strong>{status === 'syncing' ? t('syncing_securely') : t('live_connection')}</strong>
              <small>
                {status === 'syncing'
                  ? t('syncing')
                  : countdown
                    ? t('next_sync', { time: countdown })
                    : lastSync ? t('updated_ago', { time: timeAgo(lastSync) }) : t('no_sync_yet')}
              </small>
            </div>
          )}
        </div>

        <div className="profile-wrap" ref={menuRef}>
          <button className="account-switcher" onClick={() => setMenuOpen((o) => !o)} title={t('accounts')}>
            <span className="mini-avatar">{(activeProfile ? activeProfile.name : '?').trim().charAt(0).toUpperCase() || '?'}</span>
            {!collapsed && (
              <>
                <div>
                  <strong>{activeProfile ? (activeProfile.name || t('account_name')) : t('add_account')}</strong>
                  <small>{activeProfile ? mask(activeProfile.card_id) : t('tap_to_add')}</small>
                </div>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </>
            )}
          </button>

          {menuOpen && (
            <div className="profile-menu">
              <div className="profile-menu-label">{t('accounts')}</div>
              {profiles.length === 0 && <div className="profile-menu-empty">{t('no_accounts')}</div>}
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className={`profile-menu-item ${String(p.id) === String(activeProfile ? activeProfile.id : '') ? 'active' : ''}`}
                  onClick={() => {
                    setMenuOpen(false);
                    if (String(p.id) !== String(activeProfile ? activeProfile.id : '')) onSwitchProfile(p.id);
                  }}
                >
                  <span className="profile-menu-avatar">{(p.name || '?').trim().charAt(0).toUpperCase()}</span>
                  <span className="profile-menu-name">{p.name || t('account_name')}</span>
                  <span className="profile-menu-card">{mask(p.card_id)}</span>
                  {String(p.id) === String(activeProfile ? activeProfile.id : '') && <span className="acct-active-badge">{t('active')}</span>}
                </button>
              ))}
              <div className="profile-menu-sep" />
              <button className="profile-menu-manage" onClick={() => { setMenuOpen(false); onManageAccounts(); }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
                {t('manage_accounts')}
              </button>
            </div>
          )}
        </div>

        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4 3 12l6 8" /><path d="M21 4l-6 8 6 8" /></svg>
          {!collapsed && <span>{t('collapse_sidebar')}</span>}
        </button>

        <div className="sidebar-theme-row">
          <span className="sidebar-theme-label">{isDark ? t('dark_mode') : t('light_mode')}</span>
          <ThemeSwitch checked={!isDark} onChange={onToggleTheme} />
        </div>
      </div>
    </aside>
  );
}
