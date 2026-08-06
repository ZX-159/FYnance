// lib/api.js — thin typed wrapper over the preload bridge (window.api).
// Guards for running in a plain browser (vite dev) with no-op stubs.

const bridge = window.api;

export const hasBridge = Boolean(bridge);

export const api = bridge || {
  runSync: async () => false,
  getState: async () => ({ status: 'idle', lastSync: null, lastResult: null, settings: {} }),
  onState: () => () => {},
  getHistory: async () => ({ rows: [] }),
  getBalanceHistory: async () => ({ rows: [] }),
  getStats: async () => ({}),
  getMonthly: async () => ({ months: [], totals: {} }),
  exportCsv: async () => ({ saved: false }),
  getSettings: async () => ({}),
  setSettings: async (p) => p,
  resetDb: async () => ({ transactions_deleted: 0, balances_deleted: 0, settings_reset: true }),
  resetOwnDb: async () => ({ transactions_deleted: 0, balances_deleted: 0 }),
  checkForUpdates: async () => ({ status: 'none' }),
  getDebugInfo: async () => ({}),
  exportBackup: async () => ({ saved: false }),
  importBackup: async () => ({ imported: false }),
  profilesList: async () => [],
  profilesAdd: async () => ({}),
  profilesUpdate: async () => ({}),
  profilesDelete: async () => ({}),
  profilesActivate: async () => ({}),
};

/** Fetch history + balance history + stats + monthly for a card in one shot. */
export async function refreshAll(cardId) {
  const [hist, bal, stats, monthly] = await Promise.all([
    api.getHistory({ cardId, limit: 500 }),
    api.getBalanceHistory({ cardId, limit: 120 }),
    api.getStats({ cardId }),
    api.getMonthly({ cardId }),
  ]);
  return {
    history: (hist && hist.rows) || [],
    balanceHistory: (bal && bal.rows) || [],
    stats: stats || {},
    monthly: monthly || { months: [], totals: {} },
  };
}
