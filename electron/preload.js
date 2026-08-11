'use strict';
/**
 * preload.js — secure IPC bridge.
 * Exposes a minimal, typed API to the renderer via contextBridge.
 * The renderer never touches Node APIs directly.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // sync
  runSync: () => ipcRenderer.invoke('sync:run'),
  // state
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on('state:update', listener);
    return () => ipcRenderer.removeListener('state:update', listener);
  },
  // history & stats
  getHistory: (opts) => ipcRenderer.invoke('history:get', opts || {}),
  getBalanceHistory: (opts) => ipcRenderer.invoke('balancehistory:get', opts || {}),
  getStats: (opts) => ipcRenderer.invoke('stats:get', opts || {}),
  getMonthly: (opts) => ipcRenderer.invoke('monthly:get', opts || {}),
  exportCsv: (kind) => ipcRenderer.invoke('export:csv', { kind }),
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch || {}),
  // factory reset
  resetDb: () => ipcRenderer.invoke('db:reset'),
  resetOwnDb: () => ipcRenderer.invoke('db:reset-own'),
  // updates & app info
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openReleasePage: () => ipcRenderer.invoke('update:open-release'),
  // debug
  getDebugInfo: () => ipcRenderer.invoke('debug:info'),
  // backup & restore
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  // multi-user profiles
  profilesList: () => ipcRenderer.invoke('profiles:list'),
  profilesAdd: (name, cardId, prefs) => ipcRenderer.invoke('profiles:add', { name, card_id: cardId, ...(prefs || {}) }),
  profilesUpdate: (id, patch) => ipcRenderer.invoke('profiles:update', { id, ...patch }),
  profilesDelete: (id) => ipcRenderer.invoke('profiles:delete', { id }),
  profilesActivate: (id) => ipcRenderer.invoke('profiles:activate', { id }),
});
