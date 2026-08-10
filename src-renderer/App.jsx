import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import HistoryView from './components/HistoryView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import OnboardingWizard from './components/OnboardingWizard';
import Toasts from './components/Toasts';
import { api, refreshAll } from './lib/api';
import { applyTheme, watchSystemTheme } from './lib/theme';
import { toast } from './lib/toast';
import { I18nProvider, useI18n } from './lib/i18n';

const DEFAULT_STATE = {
  status: 'idle',
  lastSync: null,
  lastResult: null,
  error: null,
  settings: {
    card_id: '',
    interval_minutes: '60',
    theme: 'system',
    language: 'en',
    sync_on_launch: '1',
    minimize_to_tray: '1',
    card_style: 'flip-sage',
    theme_family: 'sage',
    active_profile: '',
    monthly_budget: '',
    low_balance_threshold: '',
    update_mode: 'auto',
  },
};

function Shell() {
  const { t } = useI18n();
  const [view, setView] = useState('overview');
  const [appState, setAppState] = useState(DEFAULT_STATE);
  const [data, setData] = useState({ history: [], balanceHistory: [], stats: {}, monthly: { months: [], totals: {} } });
  const [profiles, setProfiles] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');

  const loadData = useCallback(async (cardOverride) => {
    const cardId = (cardOverride ?? appState.settings.card_id ?? '').trim();
    if (!cardId) return;
    try {
      const fresh = await refreshAll(cardId);
      setData(fresh);
    } catch (e) {
      console.warn('refresh failed', e);
    }
  }, [appState.settings.card_id]);

  // initial state + live updates from the main process
  useEffect(() => {
    api.getState().then((s) => {
      setAppState((prev) => ({ ...DEFAULT_STATE, ...s }));
      applyTheme((s.settings || {}).theme || 'system', (s.settings || {}).theme_family || 'sage');
    });
    loadProfiles();
    return api.onState((s) => {
      setAppState((prev) => ({ ...prev, ...s }));
      if (s.status === 'ok') {
        loadData();
      } else if (s.status === 'error' && s.error) {
        toast(s.error, 'error');
      }
    });
  }, [loadData]);

  // theme handling (incl. system changes)
  useEffect(() => {
    const family = appState.settings.theme_family || 'sage';
    applyTheme(appState.settings.theme || 'system', family);
    if ((appState.settings.theme || 'system') === 'system') {
      return watchSystemTheme(() => applyTheme('system', family));
    }
  }, [appState.settings.theme, appState.settings.theme_family]);

  const loadProfiles = useCallback(async () => {
    try {
      const list = await api.profilesList();
      setProfiles(list);
      if (list.length === 0) {
        setWizardOpen(true);          // first run → guided setup
      } else {
        setWizardOpen(false);
      }
    } catch (e) {
      console.warn('profiles load failed', e);
    }
  }, []);

  // profile CRUD — applyProfileResult-style: main pushes state, we just refresh
  const handleProfileAction = async (fn, okMsg, opts = {}) => {
    try {
      await fn();
      await loadProfiles();
      // main pushed new settings (active profile's card + prefs); reload data
      const st = await api.getState();
      setAppState((prev) => ({ ...prev, ...st }));
      if (st.settings && st.settings.card_id) loadData(st.settings.card_id);
      if (okMsg) toast(okMsg, 'ok');
      if (opts.scrollTop) scrollTop();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // auto initial sync when a card is configured but never synced
  useEffect(() => {
    if ((appState.settings.card_id || '').trim() && !appState.lastSync) {
      const timer = setTimeout(() => api.runSync(), 900);
      return () => clearTimeout(timer);
    }
  }, [appState.settings.card_id, appState.lastSync]);

  const handleSync = async () => {
    try {
      return await api.runSync();
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };

  const handleSaveSettings = async (patch) => {
    const next = await api.setSettings(patch);
    setAppState((prev) => ({ ...prev, settings: next }));
    if (patch.card_id !== undefined) loadData(patch.card_id);
    return next;
  };

  const toggleTheme = async () => {
    const cur = appState.settings.theme || 'system';
    const effective =
      cur === 'dark' || cur === 'light'
        ? cur
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = effective === 'dark' ? 'light' : 'dark';
    await handleSaveSettings({ theme: next });
  };

  const scrollTop = () => {
    // scroll the active view back to the top after destructive actions
    const el = document.querySelector('.view.active');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // backup: export → save dialog handled in main; import → reload everything
  const handleExportBackup = async () => {
    const res = await api.exportBackup();
    if (res.saved) toast(t('backup_exported', { path: res.filePath }), 'ok', 7000);
    else if (!res.canceled) toast(res.error || t('backup_failed'), 'error');
    return res;
  };
  const handleImportBackup = async () => {
    const res = await api.importBackup();
    if (res.imported) {
      await loadProfiles();
      const st = await api.getState();
      setAppState((prev) => ({ ...prev, ...st }));
      if (st.settings && st.settings.card_id) loadData(st.settings.card_id);
      toast(t('backup_imported', { tx: res.transactions_added, bal: res.balances_added, profiles: res.profiles_added }), 'ok', 7000);
    } else if (!res.canceled) {
      toast(res.error || t('backup_failed'), 'error');
    }
    return res;
  };

  // per-user reset: wipe only the ACTIVE account's data
  const handleResetOwn = async () => {
    const result = await api.resetOwnDb();
    setData({ history: [], balanceHistory: [], stats: {}, monthly: { months: [], totals: {} } });
    await loadProfiles();
    const st = await api.getState();
    setAppState((prev) => ({ ...prev, ...st }));
    scrollTop();
    return result;
  };

  // factory reset: wipe everything, return to first-run (lands on Overview)
  const handleResetDb = async () => {
    const result = await api.resetDb();
    setAppState(DEFAULT_STATE);
    setData({ history: [], balanceHistory: [], stats: {}, monthly: { months: [], totals: {} } });
    setProfiles([]);
    await loadProfiles();
    setView('overview');
    setWizardDismissed(false);
    scrollTop();
    return result;
  };

  const titles = {
    overview: t('nav_overview'),
    history: t('nav_history'),
    analytics: t('nav_analytics'),
    settings: t('nav_settings'),
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onNavigate={setView}
        status={appState.status}
        lastSync={appState.lastSync}
        balance={appState.lastResult ? `RM ${appState.lastResult.balance_rm}` : null}
        nextSyncAt={appState.nextSyncAt}
        theme={appState.settings.theme || 'system'}
        activeProfile={profiles.find((x) => String(x.id) === String(appState.settings.active_profile)) || null}
        profiles={profiles}
        onSwitchProfile={(id) => handleProfileAction(() => api.profilesActivate(id), t('account_switched'))}
        onManageAccounts={() => setView('settings')}
        onToggleTheme={toggleTheme}
      />
      <main className="main">
        <Topbar
          title={titles[view] || t('nav_overview')}
          eyebrow={t('eyebrow_' + view) || ''}
          appState={appState}
          data={data}
          theme={appState.settings.theme || 'system'}
          onToggleTheme={toggleTheme}
          onSync={handleSync}
          onSearch={(q) => { setHistoryQuery(q); setView('history'); }}
        />
        {view === 'overview' && (
          <section className="view active">
            <Overview
              appState={appState}
              data={data}
              cardConfigured={Boolean((appState.settings.card_id || '').trim())}
              themeKey={[appState.settings.theme_family || 'sage', appState.settings.theme || 'system'].join('-')}
              cardStyle={appState.settings.card_style || 'flip-sage'}
              onGotoHistory={() => setView('history')}
              onGotoSettings={() => setView('settings')}
              onGotoAnalytics={() => setView('analytics')}
            />
          </section>
        )}
        {view === 'history' && (
          <section className="view active">
            <HistoryView key={historyQuery} data={data} initialQuery={historyQuery} />
          </section>
        )}
        {view === 'analytics' && (
          <section className="view active">
            <AnalyticsView data={data} themeKey={[appState.settings.theme_family || 'sage', appState.settings.theme || 'system'].join('-')} />
          </section>
        )}
        {view === 'settings' && (
          <section className="view active">
            <SettingsView
              appState={appState}
              data={data}
              profiles={profiles}
              onSave={handleSaveSettings}
              onResetDb={handleResetDb}
              onResetOwn={handleResetOwn}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onAddProfile={(name, cardId, prefs) => handleProfileAction(
                () => api.profilesAdd(name, cardId, prefs || { card_style: 'flip-sage', theme_family: 'sage' }),
                t('account_added'))}
              onUpdateProfile={(id, patch) => handleProfileAction(() => api.profilesUpdate(id, patch), t('account_updated'))}
              onDeleteProfile={(id) => handleProfileAction(() => api.profilesDelete(id), t('account_deleted'), { scrollTop: true })}
              onSwitchProfile={(id) => handleProfileAction(() => api.profilesActivate(id), t('account_switched'))}
            />
          </section>
        )}
      </main>
      {wizardOpen && !wizardDismissed && profiles.length === 0 && (
        <OnboardingWizard
          onComplete={async (name, cardId) => {
            await handleProfileAction(
              () => api.profilesAdd(name, cardId, { card_style: 'flip-sage', theme_family: 'sage' }),
              t('account_added'));
            setWizardDismissed(true);
          }}
          onSkip={() => setWizardDismissed(true)}
        />
      )}
      <Toasts />
    </div>
  );
}

export default function App() {
  // language lives in settings; re-render the whole tree when it changes
  const [lang, setLang] = useState('en');
  useEffect(() => {
    api.getState().then((s) => setLang((s.settings || {}).language || 'en'));
    return api.onState((s) => {
      if (s.settings && s.settings.language) setLang(s.settings.language);
    });
  }, []);
  return (
    <I18nProvider language={lang}>
      <Shell />
    </I18nProvider>
  );
}
