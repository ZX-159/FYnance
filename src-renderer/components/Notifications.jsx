// components/Notifications.jsx — the signals bell + popover.
// Items are derived from real data; each has a stable id so read-state
// persists. "Mark all read" clears the orange dot; "Clear" empties the list.
// Read ids are kept in localStorage (per device).

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';

const LS_KEY = 'fynance_notifs_read_v1';

function loadRead() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveRead(set) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export default function Notifications({ appState, data }) {
  const { t, timeAgo } = useI18n();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => (typeof window !== 'undefined' ? loadRead() : new Set()));
  const [cleared, setCleared] = useState(false);
  const { status, lastSync } = appState;
  const s = data.stats || {};

  // derive notification items from real data (stable ids)
  const items = useMemo(() => {
    const out = [];
    const threshold = Number(appState.settings.low_balance_threshold || '');
    const bal = appState.lastResult ? Number(appState.lastResult.balance_value) : null;
    if (threshold > 0 && bal !== null && bal <= threshold) {
      out.push({
        id: `low-${threshold}-${bal}`,
        icon: 'amber',
        iconSvg: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 7l-5-5-5 5" /><path d="M2 12h20" /></svg>
        ),
        title: t('low_balance'),
        sub: t('low_balance_sub', { bal: Number(bal).toFixed(2), limit: threshold.toFixed(2) }),
      });
    }
    if (s.unknown_total > 0) {
      out.push({
        id: `unknown-${s.unknown_total}`,
        icon: 'amber',
        iconSvg: (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        ),
        title: t('signal_unknown_spend'),
        sub: t('signal_unknown_sub', { n: s.unknown_total.toFixed(2) }),
      });
    }
    out.push({
      id: `sync-${lastSync || 'never'}`,
      icon: 'blue',
      iconSvg: (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
      ),
      title: t('signal_sync_complete'),
      sub: lastSync ? t('updated_ago', { time: timeAgo(lastSync) }) : t('no_sync_yet'),
    });
    return out;
  }, [s.unknown_total, lastSync, t, timeAgo]);

  // new items (not read & not cleared) → orange dot
  const unread = items.filter((i) => !readIds.has(i.id) && !cleared);

  // when the sync state changes, un-clear so fresh items surface again
  useEffect(() => {
    if (lastSync) setCleared(false);
  }, [lastSync]);

  const markAllRead = () => {
    const next = new Set(readIds);
    items.forEach((i) => next.add(i.id));
    setReadIds(next);
    saveRead(next);
  };

  const clearAll = () => {
    setCleared(true);
  };

  return (
    <div className="notice-wrap">
      <button className={`icon-button notification ${unread.length ? 'has-unread' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={t('signals')}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread.length > 0 && <i />}
      </button>

      {open && (
        <div className="notification-popover">
          <div className="popover-head">
            <strong>{t('signals')}</strong>
            <div className="popover-actions">
              <button className="popover-btn" onClick={markAllRead}>{t('mark_all_read')}</button>
              <button className="popover-btn danger" onClick={clearAll}>{t('clear_all')}</button>
            </div>
          </div>
          {items.length === 0 || cleared ? (
            <div className="notif-empty">{t('notifications_empty')}</div>
          ) : (
            items.map((n) => (
              <div className="signal-row" key={n.id}>
                <span className={`signal-icon ${n.icon}`}>{n.iconSvg}</span>
                <div><strong>{n.title}</strong><small>{n.sub}</small></div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
