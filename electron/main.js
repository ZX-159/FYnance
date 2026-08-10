'use strict';
/**
 * main.js — Electron main process.
 *
 * Responsibilities:
 *   • window creation (isolated, secure renderer, loads built Vite bundle)
 *   • system tray — app keeps running & auto-syncing when the window is closed
 *   • background sync scheduler (configurable interval, overlap-safe)
 *   • IPC surface for the renderer (sync, state, history, stats, settings)
 *   • lifecycle of the Python data service (PythonBridge)
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { PythonBridge } = require('./python-bridge');

const APP_NAME = 'FYnance';
const DEFAULT_INTERVAL_MIN = 60;
const SYNC_TIMEOUT_MS = 60000;

let mainWindow = null;
let bridge = null;
let tray = null;
let isQuitting = false;

/* ------------------------------------------------------------------ state */

const state = {
  status: 'idle',            // idle | syncing | ok | error
  error: null,               // human-readable error when status === 'error'
  lastSync: null,            // ISO timestamp of last successful sync
  nextSyncAt: null,          // ISO timestamp of the next scheduled sync
  lastResult: null,          // latest snapshot (name/balance/transactions)
  settings: {
    card_id: '',
    interval_minutes: String(DEFAULT_INTERVAL_MIN),
    theme: 'system',
    language: 'en',
    sync_on_launch: '1',
    minimize_to_tray: '1',
    card_style: 'flip-sage',
    theme_family: 'sage',
    active_profile: '',
    idle_mode: '0',
    max_history: '500',
    update_mode: 'auto',
  },
};

function pushState(patch) {
  Object.assign(state, patch);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('state:update', state);
  }
  updateTray();
}

/** Is the history cap set to unlimited? ('0' or 'unlimited') */
function historyUnlimited() {
  const v = String(state.settings.max_history || '500').toLowerCase();
  return v === '0' || v === 'unlimited' || v === '';
}

/** Trim the local history archive to the configured max (default 500 rows). */
async function trimHistory() {
  if (historyUnlimited()) return;   // unlimited → never trim
  try {
    const max = Math.max(50, parseInt(state.settings.max_history, 10) || 500);
    const { rows } = await bridge.request('history', { card_id: (state.settings.card_id || '').trim(), limit: 100000 });
    if (rows.length > max) {
      await bridge.request('history_trim', { card_id: (state.settings.card_id || '').trim(), keep: max });
    }
  } catch { /* best effort */ }
}

/* --------------------------------------------------------------- scheduler */

let syncTimer = null;
let syncing = false;

let idleUntil = 0;   // timestamp: pause auto-syncs while in "idle mode"

function scheduleNext() {
  if (syncTimer) clearTimeout(syncTimer);
  const minutes = Math.max(1, parseInt(state.settings.interval_minutes, 10) || DEFAULT_INTERVAL_MIN);

  // idle mode: don't auto-sync while the window is hidden (tray)
  const hidden = !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible();
  if (state.settings.idle_mode === '1' && hidden) {
    // stay quiet; wake up in a few minutes and re-check (cheap)
    const wakeMs = Math.min(minutes * 60 * 1000, 10 * 60 * 1000);
    state.nextSyncAt = new Date(Date.now() + wakeMs).toISOString();
    pushState({ nextSyncAt: state.nextSyncAt });
    syncTimer = setTimeout(() => {
      syncTimer = null;
      const h = !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible();
      if (h) { scheduleNext(); return; }   // still hidden → wait again
      runSync(false).finally(scheduleNext); // window visible again → sync
    }, wakeMs);
    return;
  }

  const ms = minutes * 60 * 1000;
  state.nextSyncAt = new Date(Date.now() + ms).toISOString();
  pushState({ nextSyncAt: state.nextSyncAt });
  syncTimer = setTimeout(() => {
    syncTimer = null;
    runSync(false).finally(scheduleNext);
  }, ms);
}

/**
 * One sync cycle: fetch via the Python service, persist, update state.
 * Overlap-safe: returns false if a sync is already in flight.
 * Runs in the main process, so it continues while the window is hidden
 * (tray) or minimized — the app keeps fetching as long as it is active.
 */
async function runSync(manual = false) {
  if (syncing) return false;
  if (!manual && state.settings.idle_mode === '1') {
    const hidden = !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible();
    if (hidden) return false;   // idle mode: no background auto-syncs
  }
  const cardId = (state.settings.card_id || '').trim();
  if (!cardId) {
    pushState({ status: 'idle', error: 'No card ID configured — open Settings.' });
    return false;
  }
  syncing = true;
  pushState({ status: 'syncing', error: null });
  try {
    const data = await bridge.request('check', { card_id: cardId }, SYNC_TIMEOUT_MS);
    pushState({
      status: 'ok',
      lastSync: new Date().toISOString(),
      lastResult: data.snapshot,
      error: null,
    });
    trimHistory();
  } catch (err) {
    const kind = err.kind || '';
    const friendly =
      kind === 'notfound'
        ? `Card ID "${cardId}" was not recognised by the school server.`
        : kind === 'network'
          ? 'Cannot reach the school server. Are you on a Malaysian/local connection?'
          : `Sync failed: ${err.message}`;
    pushState({ status: 'error', error: friendly });
  } finally {
    syncing = false;
  }
  return true;
}

/* ------------------------------------------------------------------- IPC */

function registerIpc() {
  ipcMain.handle('sync:run', () => runSync(true));
  ipcMain.handle('state:get', () => state);
  ipcMain.handle('history:get', async (_e, { cardId, limit = 300 } = {}) => {
    if (!historyUnlimited()) {
      const max = parseInt(state.settings.max_history, 10) || 500;
      limit = Math.min(limit, max);
    }
    const id = (cardId || state.settings.card_id || '').trim();
    if (!id) return { rows: [] };
    return bridge.request('history', { card_id: id, limit });
  });
  ipcMain.handle('balancehistory:get', async (_e, { cardId, limit = 120 } = {}) => {
    const id = (cardId || state.settings.card_id || '').trim();
    if (!id) return { rows: [] };
    return bridge.request('balance_history', { card_id: id, limit });
  });
  ipcMain.handle('stats:get', async (_e, { cardId } = {}) => {
    const id = (cardId || state.settings.card_id || '').trim();
    if (!id) return {};
    return bridge.request('stats', { card_id: id });
  });

  ipcMain.handle('monthly:get', async (_e, { cardId } = {}) => {
    const id = (cardId || state.settings.card_id || '').trim();
    if (!id) return { months: [], totals: {} };
    return bridge.request('monthly', { card_id: id });
  });

  /**
   * CSV export — shows a native save dialog, then writes the file.
   * kind: 'transactions' | 'monthly' | 'balances'
   */
  ipcMain.handle('export:csv', async (_e, { kind = 'transactions' } = {}) => {
    const cardId = (state.settings.card_id || '').trim();
    if (!cardId) return { saved: false, error: 'No card ID configured.' };

    const stamp = new Date().toISOString().slice(0, 10);
    const names = { transactions: 'transactions', monthly: 'monthly-summary', balances: 'balance-history' };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${names[kind]}`,
      defaultPath: path.join(app.getPath('downloads'), `ewallet-${names[kind]}-${stamp}.csv`),
      filters: [{ name: 'CSV files', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return { saved: false, canceled: true };

    let csv = '';
    if (kind === 'monthly') {
      const { months, totals } = await bridge.request('monthly', { card_id: cardId });
      csv = buildMonthlyCsv(months, totals);
    } else if (kind === 'balances') {
      const { rows } = await bridge.request('balance_history', { card_id: cardId, limit: 10000 });
      csv = buildBalancesCsv(rows);
    } else {
      const { rows } = await bridge.request('history', { card_id: cardId, limit: 10000 });
      csv = buildTransactionsCsv(rows);
    }

    try {
      fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8'); // BOM for Excel
      return { saved: true, filePath };
    } catch (err) {
      return { saved: false, error: err.message };
    }
  });

  ipcMain.handle('settings:get', () => state.settings);
  ipcMain.handle('settings:set', async (_e, patch = {}) => {
    const next = await bridge.request('settings_set', { values: patch });
    state.settings = { ...state.settings, ...next.settings };
    pushState({ settings: state.settings });
    if (patch.interval_minutes !== undefined) scheduleNext();
    if (patch.card_id !== undefined) runSync(true);
    if (patch.idle_mode !== undefined) scheduleNext();
    if (patch.max_history !== undefined) trimHistory();
    if (patch.update_mode !== undefined) applyUpdateMode();
    return state.settings;
  });

  // ── multi-user profiles ────────────────────────────────────────────────
  const applyProfileResult = async (r) => {
    if (r && r.settings) {
      state.settings = { ...state.settings, ...r.settings };
      if (r.settings.card_id !== undefined) runSync(true);
      pushState({ settings: state.settings });
    }
    return r;
  };

  ipcMain.handle('profiles:list', async () => {
    const r = await bridge.request('profile_list');
    return r.profiles || [];
  });
  ipcMain.handle('profiles:add', async (_e, { name, card_id, card_style, theme_family, monthly_budget } = {}) =>
    applyProfileResult(await bridge.request('profile_add', { name, card_id, card_style, theme_family, monthly_budget })));
  ipcMain.handle('profiles:update', async (_e, { id, name, card_id, card_style, theme_family, monthly_budget } = {}) =>
    applyProfileResult(await bridge.request('profile_update', { id, name, card_id, card_style, theme_family, monthly_budget })));
  ipcMain.handle('profiles:delete', async (_e, { id } = {}) =>
    applyProfileResult(await bridge.request('profile_delete', { id })));
  ipcMain.handle('profiles:activate', async (_e, { id } = {}) =>
    applyProfileResult(await bridge.request('profile_activate', { id })));

  // ── backup & restore ────────────────────────────────────────────────────
  ipcMain.handle('backup:export', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export FYnance backup',
      defaultPath: path.join(app.getPath('downloads'), `fynance-backup-${stamp}.db`),
      filters: [{ name: 'FYnance backup', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { saved: false, canceled: true };
    try {
      const { data_b64, size } = await bridge.request('backup_export', {}, 60000);
      fs.writeFileSync(filePath, Buffer.from(data_b64, 'base64'));
      return { saved: true, filePath, size };
    } catch (err) {
      return { saved: false, error: err.message };
    }
  });

  ipcMain.handle('backup:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import FYnance backup (merges into current data)',
      properties: ['openFile'],
      filters: [{ name: 'FYnance backup', extensions: ['db', 'sqlite'] }],
    });
    if (canceled || !filePaths.length) return { imported: false, canceled: true };
    try {
      const buf = fs.readFileSync(filePaths[0]);
      const res = await bridge.request('backup_import', { data_b64: buf.toString('base64') }, 120000);
      return { imported: true, ...res };
    } catch (err) {
      return { imported: false, error: err.message };
    }
  });

  /**
   * Per-user reset — wipes ONLY the active account's data + config.
   * Other accounts and their history are untouched.
   */
  ipcMain.handle('db:reset-own', async () => {
    const pid = state.settings.active_profile;
    const result = await bridge.request('reset_own', { id: pid }, 30000);
    state.lastResult = null;
    state.lastSync = null;
    state.error = null;
    state.status = 'idle';
    if (result && result.settings) {
      state.settings = { ...state.settings, ...result.settings };
    }
    scheduleNext();
    pushState({ ...state });
    return result;
  });

  /**
   * Factory reset — wipes ALL data and settings in the Python service,
   * then clears the in-memory state so the UI returns to first-run.
   */
  ipcMain.handle('db:reset', async () => {
    const result = await bridge.request('reset', {}, 30000);
    state.lastResult = null;
    state.lastSync = null;
    state.error = null;
    state.status = 'idle';
    state.settings = {
      card_id: '',
      interval_minutes: String(DEFAULT_INTERVAL_MIN),
      theme: 'system',
      language: 'en',
      sync_on_launch: '1',
      minimize_to_tray: '1',
      card_style: 'flip-sage',
      theme_family: 'sage',
      active_profile: '',
      idle_mode: '0',
      max_history: '500',
      update_mode: 'auto',
    };
    scheduleNext();
    pushState({ ...state });
    return result;
  });
}

/* ---------------------------------------------------------------- window */

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  const wasHidden = !mainWindow.isVisible();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  // if we were idle-hidden (tray), catch up with a sync on wake
  if (wasHidden && state.settings.idle_mode === '1' && (state.settings.card_id || '').trim()) {
    runSync(true);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b1020',
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  const isDev = process.argv.includes('--dev') || process.env.EWD_DEV === '1';
  if (isDev) {
    // dev mode: load the Vite dev server (hot reload). Start it with:
    //   npm run dev:renderer   (in another terminal)
    mainWindow.loadURL(process.env.EWD_DEV_URL || 'http://localhost:5173');
  } else {
    // production: load the built Vite bundle
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // close → hide to tray (app keeps syncing in the background)
  // disabled via Settings → "Minimize to tray on close"
  mainWindow.on('close', (e) => {
    if (!isQuitting && state.settings.minimize_to_tray !== '0') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // external links → system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ------------------------------------------------------------------ tray */

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(process.platform === 'darwin' ? icon : icon.resize({ width: 20, height: 20 }));
  tray.setToolTip(`${APP_NAME} — ${state.status}`);
  rebuildTrayMenu();
  tray.on('double-click', () => showWindow());
}

function rebuildTrayMenu() {
  if (!tray) return;
  const balance = state.lastResult ? `RM ${state.lastResult.balance_rm}` : '—';
  const menu = Menu.buildFromTemplate([
    { label: `Balance: ${balance}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => showWindow() },
    { label: 'Sync Now', click: () => runSync(true) },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function updateTray() {
  if (!tray) return;
  const balance = state.lastResult ? `RM ${state.lastResult.balance_rm}` : '—';
  tray.setToolTip(`${APP_NAME} — ${state.status} · ${balance}`);
  rebuildTrayMenu();
}

/* ------------------------------------------------------------------- CSV */

function csvCell(v) {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function buildTransactionsCsv(rows) {
  const head = ['date', 'shop', 'description', 'quantity', 'unit_price', 'total_rm', 'type', 'first_seen_at'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.date), csvCell(r.shop), csvCell(r.description),
      csvCell(r.quantity), csvCell(r.unit_price), csvCell(r.total),
      r.inferred ? 'inferred-unknown' : 'known',
      csvCell((r.fetched_at || '').slice(0, 10)),
    ].join(','));
  }
  return lines.join('\r\n');
}

function buildMonthlyCsv(months, totals) {
  const lines = [
    ['month', 'known_spent_rm', 'unknown_spent_rm', 'total_spent_rm', 'topup_rm',
     'tx_count', 'unknown_count', 'start_balance_rm', 'end_balance_rm'].join(','),
  ];
  for (const m of months) {
    lines.push([
      csvCell(m.month), csvCell(m.known_total), csvCell(m.unknown_total),
      csvCell(m.total_spent), csvCell(m.topup_total), csvCell(m.tx_count),
      csvCell(m.unknown_count),
      m.start_balance === null ? '' : csvCell(m.start_balance),
      m.end_balance === null ? '' : csvCell(m.end_balance),
    ].join(','));
  }
  lines.push([
    csvCell('TOTAL'), csvCell(totals.known_total), csvCell(totals.unknown_total),
    csvCell(totals.total_spent), csvCell(totals.topup_total),
    csvCell(totals.tx_count), csvCell(totals.unknown_count), '', '',
  ].join(','));
  return lines.join('\r\n');
}

function buildBalancesCsv(rows) {
  const lines = [['fetched_at', 'balance_rm'].join(',')];
  for (const r of rows) {
    lines.push([csvCell(r.fetched_at), csvCell(r.balance_rm)].join(','));
  }
  return lines.join('\r\n');
}

/* ------------------------------------------------------------------- app */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  // ── auto-update (packaged builds only) ──────────────────────────────────
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

let autoUpdater = null;
function initAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) =>
      pushState({ update: { status: 'available', current: app.getVersion(), latest: info.version } }));
    autoUpdater.on('update-not-available', () =>
      pushState({ update: { status: 'none', current: app.getVersion() } }));
    autoUpdater.on('update-downloaded', () =>
      pushState({ update: { status: 'downloaded', current: app.getVersion() } }));
    autoUpdater.on('error', (err) =>
      pushState({ update: { status: 'error', current: app.getVersion(), error: err.message } }));
  } catch (err) {
    console.error('[updater] init failed:', err.message);
  }
}

function applyUpdateMode() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = state.settings.update_mode !== 'manual';
}

ipcMain.handle('debug:info', async () => {
  const info = {
    app: { name: APP_NAME, version: app.getVersion(), packaged: app.isPackaged },
    platform: { os: `${process.platform} ${process.arch}`, node: process.versions.node, electron: process.versions.electron, chrome: process.versions.chrome },
    paths: { userData: app.getPath('userData'), exe: app.isPackaged ? process.execPath : '(dev)' },
    state: {
      status: state.status,
      lastSync: state.lastSync,
      lastError: state.error,
      intervalMinutes: state.settings.interval_minutes,
      idleMode: state.settings.idle_mode,
    },
    db: { file: 'ewallet.db', path: path.join(app.getPath('userData'), 'ewallet.db') },
    time: new Date().toISOString(),
  };
  try {
    const stats = await bridge.request('stats', { card_id: (state.settings.card_id || '').trim() });
    info.db.rows = { transactions: stats.transaction_count, balances: (await bridge.request('balance_history', { card_id: (state.settings.card_id || '').trim(), limit: 1 })).rows.length, bytes: stats.db_bytes };
  } catch (e) {
    info.db.error = e.message;
  }
  return info;
});

ipcMain.handle('app:info', () => ({
  name: APP_NAME, version: app.getVersion(), packaged: app.isPackaged,
}));

ipcMain.handle('update:check', async () => {
  const current = app.getVersion();
  if (!app.isPackaged || !autoUpdater) return { status: 'dev', current };
  pushState({ update: { status: 'checking', current } });
  try {
    const saved = autoUpdater.autoDownload;
    autoUpdater.autoDownload = false;          // manual check never auto-downloads
    const result = await autoUpdater.checkForUpdates();
    autoUpdater.autoDownload = saved;
    if (result && result.updateInfo) {
      const latest = result.updateInfo.version;
      const status = compareVersions(latest, current) > 0 ? 'available' : 'none';
      pushState({ update: { status, current, latest } });
      return { status, current, latest };
    }
    pushState({ update: { status: 'none', current } });
    return { status: 'none', current };
  } catch (err) {
    pushState({ update: { status: 'error', current, error: err.message } });
    return { status: 'error', current, error: err.message };
  }
});

ipcMain.handle('update:download', async () => {
  if (!app.isPackaged || !autoUpdater) {
    return { downloaded: false, error: 'Updates are only available in packaged builds.' };
  }
  try {
    autoUpdater.autoDownload = true;
    pushState({ update: { ...state.update, status: 'downloading' } });
    await autoUpdater.downloadUpdate();
    pushState({ update: { ...state.update, status: 'downloaded' } });
    return { downloaded: true };
  } catch (err) {
    pushState({ update: { ...state.update, status: 'error', error: err.message } });
    return { downloaded: false, error: err.message };
  }
});

ipcMain.handle('update:install', () => {
  if (autoUpdater) {
    try { autoUpdater.quitAndInstall(); } catch { /* noop */ }
  }
  return { installing: true };
});

app.whenReady().then(async () => {
    app.setName(APP_NAME);
    initAutoUpdater();

    bridge = new PythonBridge({
      dbPath: path.join(app.getPath('userData'), 'ewallet.db'),
      logger: (m) => console.log(m),
    });

    createWindow();
    registerIpc();
    createTray();

    // Boot: start data service -> load persisted settings -> initial sync -> schedule
    try {
      await bridge.start(app);
      const { settings } = await bridge.request('settings_get');
      state.settings = { ...state.settings, ...settings };
      applyUpdateMode();
      if (autoUpdater && state.settings.update_mode !== 'manual') {
        autoUpdater.checkForUpdatesAndNotify().catch(() => {});
      }
      pushState({ settings: state.settings });
      if ((state.settings.card_id || '').trim() && state.settings.sync_on_launch !== '0') {
        runSync(true);           // fetch immediately on launch (toggleable)
      } else {
        pushState({ status: 'idle', error: null });
      }
      scheduleNext();            // then keep fetching on the configured interval
    } catch (err) {
      console.error('boot failed:', err);
      pushState({ status: 'error', error: `Startup: ${err.message}` });
    }

    app.on('activate', () => showWindow());
  });

  app.on('window-all-closed', () => {
    // keep running in the tray on all platforms; quit only via tray/app quit
    if (process.platform !== 'darwin' && isQuitting) app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (bridge) bridge.stop();
    if (syncTimer) clearTimeout(syncTimer);
  });
}
