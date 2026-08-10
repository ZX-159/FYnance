import { useEffect, useState } from 'react';
import { useI18n, LANGUAGES } from '../lib/i18n';
import { toast } from '../lib/toast';
import ConfirmModal from './ConfirmModal';
import DangerConfirm from './DangerConfirm';

function fmtBytes(n) {
  if (!n) return '—';
  const mb = n / (1024 * 1024);
  if (mb < 1) return `${(n / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(2)} MB`;
}

const INTERVALS = [
  { v: '5', labelKey: 'every_5m' },
  { v: '15', labelKey: 'every_15m' },
  { v: '30', labelKey: 'every_30m' },
  { v: '60', labelKey: 'every_hour' },
  { v: '240', labelKey: 'every_4h' },
  { v: '1440', labelKey: 'once_day' },
];

const CARD_STYLES = ['flip-sage', 'flip-dark', 'flip-gold', 'flip-sky', 'flip-forest', 'flip-sunset', 'flip-rose', 'flip-ocean', 'flip-ember', 'flip-platinum'];
const FAMILIES = ['sage', 'fynance', 'midnight', 'champagne', 'forest', 'sunset', 'mono', 'rose', 'ocean', 'ember'];

/* visual data for pickers */
const THEMES = [
  { key: 'sage', colors: ['#edf0ec', '#ffffff', '#17201c', '#2f765b', '#174c38', '#c9f46b'] },
  { key: 'fynance', colors: ['#f5f6f8', '#ffffff', '#0f0f11', '#3a96e7', '#d8b4f8', '#00d284'] },
  { key: 'midnight', colors: ['#eef4f7', '#ffffff', '#0f172a', '#0d9488', '#4c6ef5', '#2dd4bf'] },
  { key: 'champagne', colors: ['#f6f1e7', '#fffdf8', '#221a0e', '#b98f3c', '#c9a96a', '#e9cd92'] },
  { key: 'forest', colors: ['#f1f7f2', '#ffffff', '#12261a', '#16a34a', '#84cc16', '#4ade80'] },
  { key: 'sunset', colors: ['#fdf2f6', '#ffffff', '#2a1220', '#f97316', '#ec4899', '#fbbf24'] },
  { key: 'mono', colors: ['#f3f4f6', '#ffffff', '#111827', '#4b5563', '#9ca3af', '#d1d5db'] },
  { key: 'rose', colors: ['#fdf2f4', '#ffffff', '#2a1220', '#e11d74', '#be185d', '#f9a8d4'] },
  { key: 'ocean', colors: ['#f0f6fb', '#ffffff', '#0c1e33', '#0284c7', '#2563eb', '#38bdf8'] },
  { key: 'ember', colors: ['#fbf3ee', '#ffffff', '#2a1206', '#c2410c', '#b91c1c', '#fb923c'] },
];

const CARDS = [
  { key: 'flip-sage', grad: 'linear-gradient(135deg,#183b2e,#1f5d46 55%,#123128)', chip: '#e6d598', dark: true },
  { key: 'flip-dark', grad: 'linear-gradient(135deg,#202020,#171717 60%,#0d0d0d)', chip: '#e6d598', dark: true },
  { key: 'flip-gold', grad: 'linear-gradient(135deg,#edcb78,#f7e4b2,#fee08b)', chip: '#c9a227', dark: false },
  { key: 'flip-sky', grad: 'linear-gradient(135deg,#3a96e7,#7f6fe8 60%,#b48fe0)', chip: '#ffe9a8', dark: true },
  { key: 'flip-forest', grad: 'linear-gradient(135deg,#0e5e3a,#15803d 55%,#4ade80)', chip: '#e6d598', dark: true },
  { key: 'flip-sunset', grad: 'linear-gradient(135deg,#7c2d5e,#c2410c 60%,#f97316)', chip: '#ffe9a8', dark: true },
  { key: 'flip-rose', grad: 'linear-gradient(135deg,#fbcfe8,#f472b6 55%,#db2777)', chip: '#fff', dark: true },
  { key: 'flip-ocean', grad: 'linear-gradient(135deg,#0ea5e9,#2563eb 60%,#1e3a8a)', chip: '#ffe9a8', dark: true },
  { key: 'flip-ember', grad: 'linear-gradient(135deg,#f97316,#dc2626 60%,#7f1d1d)', chip: '#ffe9a8', dark: true },
  { key: 'flip-platinum', grad: 'linear-gradient(135deg,#f8fafc,#e2e8f0 55%,#cbd5e1)', chip: '#64748b', dark: false },
];

function maskCard(cardId) {
  const d = String(cardId || '').replace(/\D/g, '');
  return d ? `•••• ${d.slice(-4)}` : '—';
}

function PanelHead({ kicker, title }) {
  return (
    <div className="panel-heading">
      <div><span className="kicker">{kicker}</span><h3>{title}</h3></div>
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <label className="plain-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

export default function SettingsView({
  appState, data, onSave, onResetDb, onResetOwn, onExportBackup, onImportBackup, profiles,
  onAddProfile, onUpdateProfile, onDeleteProfile, onSwitchProfile,
}) {
  const { t, fmtDate } = useI18n();
  const activeId = appState.settings.active_profile;
  const active = profiles.find((p) => String(p.id) === String(activeId)) || null;

  const [cardStyle, setCardStyle] = useState('flip-sage');
  const [themeFamily, setThemeFamily] = useState('sage');
  const [budget, setBudget] = useState('');
  const [lowBal, setLowBal] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [updState, setUpdState] = useState(null); // checking | available | none | error | downloading | downloaded
  const [appVersion, setAppVersion] = useState('');
  const [updateMode, setUpdateMode] = useState('auto');

  const [interval, setIntervalV] = useState('60');
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('en');
  const [syncOnLaunch, setSyncOnLaunch] = useState(true);
  const [minimizeTray, setMinimizeTray] = useState(true);
  const [idleMode, setIdleMode] = useState(false);
  const [maxHistory, setMaxHistory] = useState('500');

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: '', card_id: '', card_style: 'flip-sage', theme_family: 'sage' });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCard, setNewCard] = useState('');

  const [showReset, setShowReset] = useState(false);
  const [showResetOwn, setShowResetOwn] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const s = appState.settings || {};
    setIntervalV(s.interval_minutes || '60');
    setTheme(s.theme || 'system');
    setLanguage(s.language || 'en');
    setSyncOnLaunch(s.sync_on_launch !== '0');
    setMinimizeTray(s.minimize_to_tray !== '0');
    setIdleMode(s.idle_mode === '1');
    setMaxHistory(s.max_history || '500');
    setUpdateMode(s.update_mode || 'auto');
    if (active) {
      setCardStyle(active.card_style || s.card_style || 'flip-sage');
      setThemeFamily(active.theme_family || s.theme_family || 'sage');
      setBudget(active.monthly_budget || s.monthly_budget || '');
      setLowBal(active.low_balance_threshold || s.low_balance_threshold || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.settings, activeId, active && active.card_style, active && active.theme_family]);

  const saveAppSettings = async (syncAfter) => {
    const patch = {
      interval_minutes: interval,
      theme,
      language,
      sync_on_launch: syncOnLaunch ? '1' : '0',
      minimize_to_tray: minimizeTray ? '1' : '0',
      idle_mode: idleMode ? '1' : '0',
      max_history: maxHistory,
    };
    try {
      await onSave(patch);
      toast(t('settings_saved'), 'ok');
      if (syncAfter) { toast(t('syncing_now'), 'info'); await window.api.runSync(); }
    } catch (e) {
      toast(t('save_failed', { msg: e.message }), 'error');
    }
  };

  // per-account look: apply IMMEDIATELY on change (fixes "nothing happens")
  const applyLook = async (patch) => {
    if (!active) return;
    try {
      await onUpdateProfile(active.id, patch);
      if (patch.card_style !== undefined) setCardStyle(patch.card_style);
      if (patch.theme_family !== undefined) setThemeFamily(patch.theme_family);
      toast(t('account_updated'), 'ok');
    } catch (e) {
      toast(t('save_failed', { msg: e.message }), 'error');
    }
  };

  const submitAdd = async () => {
    if (!newCard.trim()) { toast(t('wizard_need_card'), 'error'); return; }
    try {
      await onAddProfile(newName, newCard, { card_style: 'flip-sage', theme_family: 'sage' });
      setAdding(false); setNewName(''); setNewCard('');
      toast(t('account_added'), 'ok');
    } catch (e) { toast(t('save_failed', { msg: e.message }), 'error'); }
  };

  const submitEdit = async () => {
    try {
      await onUpdateProfile(editingId, edit);
      setEditingId(null);
      toast(t('account_updated'), 'ok');
    } catch (e) { toast(t('save_failed', { msg: e.message }), 'error'); }
  };

  useEffect(() => {
    window.api.getAppInfo().then((i) => setAppVersion(i.version || '')).catch(() => {});
  }, []);

  const copyDebug = async () => {
    try {
      const info = await window.api.getDebugInfo();
      const text = [
        'FYnance debug info',
        '==================',
        `App      : ${info.app ? info.app.name + ' v' + info.app.version + (info.app.packaged ? '' : ' (dev)') : 'n/a'}`,
        `OS       : ${info.platform ? info.platform.os + ' · Electron ' + info.platform.electron + ' · Chrome ' + info.platform.chrome : 'n/a'}`,
        `Status   : ${info.state ? info.state.status : 'n/a'}${info.state && info.state.lastSync ? ' · last sync ' + info.state.lastSync : ''}`,
        `Interval : ${info.state ? info.state.intervalMinutes + ' min' : 'n/a'}${info.state && info.state.idleMode === '1' ? ' · idle mode on' : ''}`,
        `DB       : ${info.db ? (info.db.rows ? info.db.rows.transactions + ' tx · ' + info.db.rows.balances + ' bal · ' + Math.round((info.db.bytes || 0) / 1024) + ' KB' : info.db.path) : 'n/a'}${info.db && info.db.error ? ' · err ' + info.db.error : ''}`,
        info.state && info.state.lastError ? `Error    : ${info.state.lastError}` : '',
        `Time     : ${info.time || ''}`,
      ].filter(Boolean).join('\n');
      await navigator.clipboard.writeText(text);
      toast(t('debug_copied'), 'ok');
    } catch (e) {
      toast(t('debug_failed', { msg: e.message }), 'error');
    }
  };

  const checkUpdate = async () => {
    setUpdState('checking');
    try {
      const res = await window.api.checkForUpdates();
      if (res.status === 'dev') { setUpdState(null); toast(t('updates_dev'), 'info'); }
      else if (res.status === 'none') { setUpdState('none'); toast(t('updates_none'), 'ok'); }
      else if (res.status === 'available') {
        setUpdState({ status: 'available', current: res.current, latest: res.latest });
        toast(t('updates_available', { v: res.latest }), 'info');
      }
      else { setUpdState({ status: 'error', error: res.error }); toast(res.error || t('updates_error'), 'error'); }
    } catch (e) {
      setUpdState({ status: 'error', error: e.message });
      toast(e.message || t('updates_error'), 'error');
    }
  };

  const downloadUpdate = async () => {
    setUpdState({ ...updState, status: 'downloading' });
    try {
      const res = await window.api.downloadUpdate();
      if (res.downloaded) setUpdState({ ...updState, status: 'downloaded' });
      else { setUpdState({ ...updState, status: 'error', error: res.error }); toast(res.error || t('updates_error'), 'error'); }
    } catch (e) {
      setUpdState({ ...updState, status: 'error', error: e.message });
    }
  };

  const changeUpdateMode = async (mode) => {
    setUpdateMode(mode);
    try { await onSave({ update_mode: mode }); toast(t('settings_saved'), 'ok'); }
    catch (e) { toast(t('save_failed', { msg: e.message }), 'error'); }
  };

  const confirmDelete = async () => {
    setResetting(true);
    try {
      await onDeleteProfile(deleteId);
      setDeleteId(null);
      toast(t('account_deleted'), 'ok');
    } catch (e) { toast(t('save_failed', { msg: e.message }), 'error'); }
    finally { setResetting(false); }
  };

  const confirmResetOwn = async () => {
    setResetting(true);
    try {
      await onResetOwn();
      setShowResetOwn(false);
      toast(t('reset_own_done'), 'ok');
    } catch (e) { toast(t('reset_failed', { msg: e.message }), 'error'); }
    finally { setResetting(false); }
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      await onResetDb();
      setShowReset(false);
      toast(t('reset_done'), 'ok');
    } catch (e) { toast(t('reset_failed', { msg: e.message }), 'error'); }
    finally { setResetting(false); }
  };

  return (
    <div className="page-wrap">
      <section className="welcome-row compact-welcome">
        <div>
          <h2>{t('make_it_yours')}</h2>
          <p>{t('prefs_device')}</p>
        </div>
        <button className="primary-button" onClick={() => saveAppSettings(false)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {t('save_changes')}
        </button>
      </section>

      {/* ── Accounts (integrated) ── */}
      <section className="panel settings-card">
        <PanelHead kicker={t('identity')} title={t('accounts')} />
        {profiles.length === 0 && <p className="field-hint">{t('no_accounts')}</p>}
        {profiles.map((p) => {
          const isActive = String(p.id) === String(activeId);
          const isEditing = editingId === p.id;
          return (
            <div className={`acct-item ${isActive ? 'active' : ''}`} key={p.id}>
              <div className="acct-avatar">{(p.name || '?').trim().charAt(0).toUpperCase()}</div>
              <div className="acct-main">
                {isEditing ? (
                  <div className="acct-edit">
                    <input className="acct-input" value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} placeholder={t('account_name')} />
                    <input className="acct-input" value={edit.card_id} onChange={(e) => setEdit((x) => ({ ...x, card_id: e.target.value }))} placeholder={t('card_id')} maxLength={20} />
                    <div className="acct-edit-grid">
                      <label className="acct-mini-label">{t('card_style')}
                        <select className="acct-input" value={edit.card_style} onChange={(e) => setEdit((x) => ({ ...x, card_style: e.target.value }))}>
                          {CARD_STYLES.map((cs) => <option key={cs} value={cs}>{t('card_style_' + cs.replace('flip-', ''))}</option>)}
                        </select>
                      </label>
                      <label className="acct-mini-label">{t('theme')}
                        <select className="acct-input" value={edit.theme_family} onChange={(e) => setEdit((x) => ({ ...x, theme_family: e.target.value }))}>
                          {FAMILIES.map((f) => <option key={f} value={f}>{t('theme_' + f)}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="acct-edit-actions">
                      <button className="secondary-button btn-sm" onClick={() => setEditingId(null)}>{t('cancel')}</button>
                      <button className="primary-button btn-sm" onClick={submitEdit}>{t('save_settings')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="acct-name">
                      {p.name || t('account_name')}
                      {isActive && <span className="acct-active-badge">{t('active')}</span>}
                    </div>
                    <div className="acct-cardno">
                      {maskCard(p.card_id)}
                      {p.card_style && <span className="acct-tag">{t('card_style_' + (p.card_style || '').replace('flip-', ''))}</span>}
                      {p.theme_family && <span className="acct-tag">{t('theme_' + (p.theme_family || ''))}</span>}
                    </div>
                  </>
                )}
              </div>
              {!isEditing && (
                <div className="acct-actions">
                  {!isActive && <button className="primary-button btn-sm" onClick={() => onSwitchProfile(p.id)}>{t('switch_account')}</button>}
                  <button className="icon-button icon-sm" title={t('edit')} onClick={() => { setEditingId(p.id); setEdit({ name: p.name || '', card_id: p.card_id || '', card_style: p.card_style || 'flip-sage', theme_family: p.theme_family || 'sage' }); }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                  </button>
                  <button className="icon-button icon-sm" style={{ color: 'var(--err)' }} title={t('delete')} onClick={() => setDeleteId(p.id)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {adding && (
          <div className="acct-add">
            <input className="acct-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('account_name')} autoFocus />
            <input className="acct-input" value={newCard} onChange={(e) => setNewCard(e.target.value)} placeholder={t('card_id')} maxLength={20} />
            <div className="acct-edit-actions">
              <button className="secondary-button btn-sm" onClick={() => setAdding(false)}>{t('cancel')}</button>
              <button className="primary-button btn-sm" onClick={submitAdd}>{t('add_account')}</button>
            </div>
          </div>
        )}
        {!adding && (
          <button className="secondary-button acct-add-btn" onClick={() => setAdding(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {t('add_account')}
          </button>
        )}

        {/* active account look — instant apply, visual pickers */}
        {active && (
          <>
            <div style={{ marginTop: 14 }} />
            <div className="field">
              <label>{t('theme')} · {active.name}</label>
              <div className="picker-grid themes">
                {THEMES.map((th) => (
                  <button
                    key={th.key}
                    className={`picker-option ${themeFamily === th.key ? 'active' : ''}`}
                    onClick={() => applyLook({ theme_family: th.key })}
                  >
                    <span className="picker-check">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                    <span className="theme-swatch-card" style={{ background: th.colors[0] }}>
                      <span className="theme-swatch-side" style={{ background: th.colors[3] }}>
                        <i style={{ background: th.colors[2] }} /><i style={{ background: th.colors[3] }} /><i style={{ background: th.colors[4] }} />
                      </span>
                      <span className="theme-swatch-main">
                        <i style={{ background: th.colors[1] }} />
                        <i style={{ background: th.colors[3] }} />
                        <i style={{ background: th.colors[1] }} />
                      </span>
                    </span>
                    <span className="picker-name">{t('theme_' + th.key)}</span>
                    <span className="palette-row">
                      {th.colors.map((c, i) => <i key={i} className="palette-dot" style={{ background: c }} />)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>{t('card_style')} · {active.name}</label>
              <div className="picker-grid cards">
                {CARDS.map((cd) => (
                  <button
                    key={cd.key}
                    className={`picker-option ${cardStyle === cd.key ? 'active' : ''}`}
                    onClick={() => applyLook({ card_style: cd.key })}
                  >
                    <span className="picker-check">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                    <span className="card-mini" style={{ background: cd.grad, color: cd.dark ? '#fff' : '#0f172a' }}>
                      <span className="cm-brand">FY</span>
                      <span className="cm-chip" style={{ background: cd.chip }} />
                    </span>
                    <span className="picker-name">{t('card_style_' + cd.key.replace('flip-', ''))}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t('monthly_budget')} · {active.name}</label>
              <div className="budget-row">
                <span className="budget-currency">RM</span>
                <input
                  className="acct-input"
                  type="number"
                  min="0"
                  step="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder={t('no_budget_set')}
                />
                <button className="primary-button btn-sm" onClick={() => applyLook({ monthly_budget: budget.trim() })}>
                  {t('save_settings')}
                </button>
                {budget !== '' && (
                  <button className="secondary-button btn-sm" onClick={() => { setBudget(''); applyLook({ monthly_budget: '' }); }}>
                    {t('clear')}
                  </button>
                )}
              </div>
              <p className="field-hint">{t('budget_hint')}</p>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>{t('balance_alert_label')} · {active.name}</label>
              <div className="budget-row">
                <span className="budget-currency">RM</span>
                <input
                  className="acct-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={lowBal}
                  onChange={(e) => setLowBal(e.target.value)}
                  placeholder={t('no_alert_set')}
                />
                <button className="primary-button btn-sm" onClick={() => applyLook({ low_balance_threshold: lowBal.trim() })}>
                  {t('save_settings')}
                </button>
                {lowBal !== '' && (
                  <button className="secondary-button btn-sm" onClick={() => { setLowBal(''); applyLook({ low_balance_threshold: '' }); }}>
                    {t('clear')}
                  </button>
                )}
              </div>
              <p className="field-hint">{t('low_balance_hint')}</p>
            </div>

            <p className="field-hint">{t('look_hint')}</p>
          </>
        )}
      </section>

      <section className="settings-layout">
        <div className="settings-column">
          <article className="panel settings-card">
            <PanelHead kicker={t('identity')} title={t('account_sync')} />
            <div className="setting-row">
              <div><strong>{t('active_account')}</strong><small>{active ? `${t('campus_wallet_acct', { masked: maskCard(active.card_id) })}` : t('no_accounts')}</small></div>
              <div className="setting-control">
                <span>{active ? active.name : '—'}</span>
              </div>
            </div>
            <div className="setting-row">
              <div><strong>{t('auto_sync_interval')}</strong><small>{t('when_app_open')}</small></div>
              <div className="setting-control">
                <select value={interval} onChange={(e) => setIntervalV(e.target.value)}>
                  {INTERVALS.map((i) => <option key={i.v} value={i.v}>{t(i.labelKey)}</option>)}
                </select>
              </div>
            </div>
            <div className="setting-row">
              <div><strong>{t('max_history')}</strong><small>{t('older_remain')}</small></div>
              <div className="setting-control">
                <select value={maxHistory} onChange={(e) => setMaxHistory(e.target.value)}>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                  <option value="1000">1,000</option>
                  <option value="5000">5,000</option>
                  <option value="0">{t('unlimited')}</option>
                </select>
              </div>
            </div>
          </article>

          <article className="panel settings-card">
            <PanelHead kicker={t('behaviour')} title={t('desktop_prefs')} />
            <div className="setting-row toggle-setting">
              <div><strong>{t('sync_on_launch')}</strong><small>{t('runs_quietly')}</small></div>
              <Switch checked={syncOnLaunch} onChange={setSyncOnLaunch} />
            </div>
            <div className="setting-row toggle-setting">
              <div><strong>{t('minimize_to_tray')}</strong><small>{t('keep_close')}</small></div>
              <Switch checked={minimizeTray} onChange={setMinimizeTray} />
            </div>
            <div className="setting-row toggle-setting">
              <div><strong>{t('idle_mode')}</strong><small>{t('pause_bg')}</small></div>
              <Switch checked={idleMode} onChange={setIdleMode} />
            </div>
            <div className="settings-actions">
              <button className="primary-button btn-sm" onClick={() => saveAppSettings(false)}>{t('save_settings')}</button>
            </div>
          </article>
        </div>

        <div className="settings-column">
          <article className="panel settings-card">
            <PanelHead kicker={t('interface')} title={t('appearance')} />
            <div className="theme-choice-row">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
                <span className="theme-preview light-preview"><i /><i /><i /></span>
                <strong>{t('theme_light')}</strong><small>{t('warm_paper')}</small>
              </button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
                <span className="theme-preview dark-preview"><i /><i /><i /></span>
                <strong>{t('theme_dark')}</strong><small>{t('after_hours')}</small>
              </button>
              <button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}>
                <span className="theme-preview system-preview"><i /><i /><i /></span>
                <strong>{t('theme_system')}</strong><small>{t('automatic')}</small>
              </button>
            </div>
            <div className="language-row">
              <div><strong>{t('language')}</strong><small>{t('changes_labels')}</small></div>
              <div className="language-pills">
                {LANGUAGES.map((l) => (
                  <button key={l.code} className={language === l.code ? 'active' : ''} onClick={() => setLanguage(l.code)}>{l.label}</button>
                ))}
              </div>
            </div>
          </article>

          <article className="panel settings-card">
            <PanelHead kicker={t('on_this_device')} title={t('data_storage')} />
            <div className="storage-visual">
              <div className="storage-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div><strong>{t('used', { size: fmtBytes(data.stats.db_bytes) })}</strong><span>{t('locally_encrypted')}</span></div>
              <em>{t('healthy')}</em>
            </div>
            <div className="storage-track"><span /></div>
            <div className="storage-stats">
              <div><span>{t('transactions_s')}</span><strong>{data.history.length}</strong></div>
              <div><span>{t('balance_points')}</span><strong>{data.balanceHistory.length}</strong></div>
              <div><span>{t('first_record')}</span><strong>{data.stats.first_recorded ? fmtDate(data.stats.first_recorded) : '—'}</strong></div>
            </div>
          </article>

          <article className="panel settings-card">
            <PanelHead kicker={t('on_this_device')} title={t('about_updates')} />
            <div className="setting-row">
              <div>
                <strong>{t('current_version')}</strong>
                <small>FYnance v{appVersion || '?'}{!appState.settings || null}</small>
              </div>
              <div className="setting-control"><span>v{appVersion || '—'}</span></div>
            </div>
            <div className="setting-row">
              <div>
                <strong>{t('update_mode')}</strong>
                <small>{t('updates_hint')}</small>
              </div>
              <div className="setting-control">
                <select value={updateMode} onChange={(e) => changeUpdateMode(e.target.value)}>
                  <option value="auto">{t('update_auto')}</option>
                  <option value="manual">{t('update_manual')}</option>
                </select>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <strong>{t('latest_available')}</strong>
                <small>
                  {updState === null && t('updates_hint_short')}
                  {updState && updState.latest && t('version_x', { v: updState.latest })}
                  {updState && updState.status === 'none' && t('updates_none')}
                  {updState && updState.status === 'downloaded' && t('updates_available_ready')}
                  {updState && updState.status === 'downloading' && t('downloading')}
                </small>
              </div>
              <div className="setting-control">
                <button className="secondary-button btn-sm" onClick={checkUpdate} disabled={updState && updState.status === 'checking'}>
                  <svg className={updState && updState.status === 'checking' ? 'spin' : ''} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
                  {updState && updState.status === 'checking' ? t('checking_updates') : t('check_updates')}
                </button>
              </div>
            </div>
            {updState && updState.status === 'available' && (
              <div className="settings-actions">
                <button className="primary-button btn-sm" onClick={downloadUpdate}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                  {t('download_install')}
                </button>
              </div>
            )}
            {updState && updState.status === 'downloaded' && (
              <div className="settings-actions">
                <button className="primary-button btn-sm" onClick={() => window.api.installUpdate()}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
                  {t('install_now')}
                </button>
              </div>
            )}
            {updState && updState.status === 'error' && <p className="field-hint" style={{ color: 'var(--err)' }}>{updState.error || t('updates_error')}</p>}
            <div className="settings-actions">
              <button className="secondary-button btn-sm" onClick={copyDebug}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                {t('copy_debug_info')}
              </button>
            </div>
          </article>

          <article className="panel settings-card">
            <PanelHead kicker={t('on_this_device')} title={t('backup_restore')} />
            <p className="field-hint" style={{ marginBottom: 10 }}>{t('backup_hint')}</p>
            <div className="settings-actions">
              <button className="secondary-button" onClick={onExportBackup}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                {t('export_backup')}
              </button>
              <button className="secondary-button" onClick={() => setShowImport(true)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></svg>
                {t('import_backup')}
              </button>
            </div>
          </article>

          <article className="panel settings-card danger-card">
            <div>
              <span className="danger-kicker">{t('danger_zone')}</span>
              <strong>{t('reset_own')}</strong>
              <p>{t('reset_own_hint')}</p>
            </div>
            <div className="danger-actions">
              <button onClick={() => setShowResetOwn(true)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                {t('reset_own')}
              </button>
              <button onClick={() => setShowReset(true)}>{t('reset_all')}</button>
            </div>
          </article>
        </div>
      </section>

      <DangerConfirm
        open={deleteId !== null}
        title={t('delete_account')}
        body={t('confirm_delete_account_data')}
        confirmLabel={t('delete')}
        busy={resetting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <DangerConfirm
        open={showResetOwn}
        title={t('reset_own_confirm_title')}
        body={t('reset_own_confirm_body')}
        confirmLabel={t('reset')}
        icon="reset"
        busy={resetting}
        onConfirm={confirmResetOwn}
        onCancel={() => setShowResetOwn(false)}
      />
      <ConfirmModal
        open={showImport}
        title={t('import_backup_confirm_title')}
        body={t('import_backup_confirm_body')}
        confirmLabel={t('import_backup')}
        cancelLabel={t('cancel')}
        onConfirm={async () => { setShowImport(false); await onImportBackup(); }}
        onCancel={() => setShowImport(false)}
      />

      <DangerConfirm
        open={showReset}
        title={t('reset_confirm_title')}
        body={t('reset_confirm_body')}
        confirmLabel={t('reset_all')}
        icon="reset"
        busy={resetting}
        onConfirm={confirmReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  );
}
