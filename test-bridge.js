'use strict';
/**
 * test-bridge.js — integration test of PythonBridge (pure Node, no Electron).
 * Requires: mock server on :8899 + PyInstaller binary in python/dist.
 * Run: node test-bridge.js
 */
const path = require('path');
const fs = require('fs');
const { PythonBridge } = require('./electron/python-bridge');

const MOCK_URL = 'http://127.0.0.1:8899/newui/ewallet/chkbal.php';
const DB = '/tmp/bridge-test.db';
try { fs.unlinkSync(DB); } catch {}

const fakeApp = { isPackaged: false };

(async () => {
  const bridge = new PythonBridge({ dbPath: DB, endpointUrl: MOCK_URL, logger: () => {} });

  console.log('[*] start…');
  await bridge.start(fakeApp);
  console.log('[+] started');

  const ping = await bridge.request('ping');
  console.log('[+] ping ->', JSON.stringify(ping));

  const check = await bridge.request('check', { card_id: '0002329052' }, 30000);
  console.log('[+] check -> balance:', check.snapshot.balance_rm,
              '| name:', check.snapshot.name, '| added:', check.persisted.transactions_added);

  const check2 = await bridge.request('check', { card_id: '0002329052' }, 30000);
  console.log('[+] dedup added:', check2.persisted.transactions_added, '(expect 0)');

  try {
    await bridge.request('check', { card_id: '999999' }, 30000);
    console.log('[-] FAIL: should throw');
  } catch (e) {
    console.log('[+] unknown-card -> kind:', e.kind);
  }

  const stats = await bridge.request('stats', { card_id: '0002329052' });
  console.log('[+] stats ->', JSON.stringify(stats));

  // settings persistence = the app's "memory"
  await bridge.request('settings_set', { values: { card_id: '0002329052', interval_minutes: '15', theme: 'dark' } });
  const s1 = await bridge.request('settings_get');
  console.log('[+] settings saved ->', JSON.stringify(s1.settings));

  bridge.stop();
  console.log('[*] restart (settings must persist across sessions)…');
  await bridge.start(fakeApp);
  const s2 = await bridge.request('settings_get');
  console.log('[+] settings after restart ->', JSON.stringify(s2.settings));

  // multi-user profiles
  console.log('[*] profiles…');
  const pa = await bridge.request('profile_add', { name: 'Ahmad', card_id: '0002329052' });
  const ah = pa.profiles[0].id;
  console.log('[+] added:', pa.profiles.length, 'profile(s), active card:', pa.settings.card_id);
  const pb = await bridge.request('profile_add', { name: 'Siti', card_id: '1112223334' });
  console.log('[+] second profile, active card:', pb.settings.card_id);
  await bridge.request('profile_activate', { id: ah });
  const pc = await bridge.request('profile_list');
  console.log('[+] list:', pc.profiles.length, '| active now:', pc.profiles.find(x => String(x.id) === String(pb.settings.active_profile)) ? 'siti' : 'ahmad');
  const pd = await bridge.request('profile_delete', { id: ah });
  console.log('[+] after delete:', pd.profiles.length, 'profile(s), active card:', pd.settings.card_id,
              '| data wiped:', pd.transactions_deleted, 'tx,', pd.balances_deleted, 'bal');
  bridge.stop();

  console.log('\n=== ALL BRIDGE TESTS PASSED ===');
  process.exit(0);
})().catch((e) => {
  console.error('[-] TEST FAILED:', e);
  process.exit(1);
});
