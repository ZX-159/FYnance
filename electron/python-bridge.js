'use strict';
/**
 * python-bridge.js
 * ----------------
 * Manages the native Python data service (PyInstaller-compiled `ewallet-cli`)
 * as a long-lived child process speaking line-delimited JSON over stdio.
 *
 * Binary resolution (dev vs packaged):
 *   1. Production  : process.resourcesPath/python/ewallet-cli(.exe)
 *   2. Development : <project>/python/dist/ewallet-cli(.exe)  (built binary)
 *   3. Development : fallback to system `python3` + python/ewallet_cli.py
 *                    (stdlib-only script, so any Python 3.9+ works)
 */
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

class PythonBridge {
  /**
   * @param {object} opts
   * @param {string} opts.dbPath      absolute path to the SQLite database
   * @param {string} opts.endpointUrl chkbal.php endpoint (defaults in CLI)
   * @param {string} [opts.logger]    fn(msg) for diagnostics
   */
  constructor({ dbPath, endpointUrl, logger = () => {} }) {
    this.dbPath = dbPath;
    this.endpointUrl = endpointUrl || undefined;
    this.log = logger;
    this.child = null;
    this.pending = new Map(); // id -> {resolve, reject, timer}
    this.nextId = 1;
    this.stopped = true;
    this.startupPromise = null;
  }

  /* ---------------------------------------------------------- resolution */

  /**
   * Resolve the command + args used to launch the data service.
   * @param {Electron.App} app Electron app (for app.isPackaged / resourcesPath)
   */
  resolveLaunch(app) {
    const exeName = process.platform === 'win32' ? 'ewallet-cli.exe' : 'ewallet-cli';

    // 1) Production: bundled into resources via electron-builder extraResources
    if (app && app.isPackaged) {
      const bundled = path.join(process.resourcesPath, 'python', exeName);
      if (fs.existsSync(bundled)) {
        this.log(`[bridge] production binary: ${bundled}`);
        return { command: bundled, args: [] };
      }
      throw new Error(
        `Bundled data service not found at ${bundled}. Rebuild with ` +
        '`npm run build:python` before packaging.'
      );
    }

    // 2) Development: pre-built binary in python/dist
    const projectRoot = path.join(__dirname, '..');
    const local = path.join(projectRoot, 'python', 'dist', exeName);
    if (fs.existsSync(local)) {
      this.log(`[bridge] dev binary: ${local}`);
      return { command: local, args: [] };
    }

    // 3) Development: system python3 + the stdlib-only script
    const script = path.join(projectRoot, 'python', 'ewallet_cli.py');
    if (fs.existsSync(script)) {
      const py = process.platform === 'win32' ? 'python' : 'python3';
      this.log(`[bridge] dev fallback: ${py} ${script}`);
      return { command: py, args: [script] };
    }

    throw new Error('No Python data service found. Run `npm run build:python`.');
  }

  /* ------------------------------------------------------------- lifecycle */

  start(app) {
    if (this.child && !this.child.killed) return Promise.resolve();

    const { command, args } = this.resolveLaunch(app);
    const argv = [...args, '--db', this.dbPath];
    if (this.endpointUrl) argv.push('--url', this.endpointUrl);

    this.log(`[bridge] spawning ${command} ${argv.join(' ')}`);

    const child = spawn(command, argv, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,            // no console flash on Windows
      env: { ...process.env },
    });

    this.stopped = false;
    this.child = child;

    child.on('error', (err) => {
      if (this.child !== child) return;   // stale event from a previous process
      this.log(`[bridge] spawn error: ${err.message}`);
      this._failAll(new Error(`Failed to start data service: ${err.message}`));
      this._teardown();
    });

    child.on('exit', (code, signal) => {
      if (this.child !== child) return;   // stale event from a previous process
      this.log(`[bridge] exited code=${code} signal=${signal}`);
      this._failAll(new Error(`Data service exited unexpectedly (code ${code}).`));
      this._teardown();
    });

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.log(`[bridge] non-JSON output: ${line.slice(0, 120)}`);
        return;
      }
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(Object.assign(new Error(msg.error || 'unknown error'), { kind: msg.kind }));
    });

    // keep stderr flowing to the log so diagnostics are visible in dev
    readline.createInterface({ input: child.stderr }).on('line', (l) => this.log(`[py] ${l}`));

    return new Promise((resolve, reject) => {
      // wait until the process is alive and answering
      const t0 = Date.now();
      const probe = () => {
        if (this.stopped || !this.child) return reject(new Error('data service failed to start'));
        this.request('ping', {}, 5000)
          .then(() => resolve())
          .catch(() => {
            if (Date.now() - t0 > 15000) return reject(new Error('data service did not respond'));
            setTimeout(probe, 300);
          });
      };
      setTimeout(probe, 250);
    });
  }

  stop() {
    if (this.child && !this.child.killed) {
      try { this.child.stdin.end(); } catch { /* noop */ }
      this.child.kill();
    }
    this._failAll(new Error('data service stopped'));
    this._teardown();
  }

  _teardown() {
    this.stopped = true;
    this.child = null;
  }

  _failAll(err) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  /* ------------------------------------------------------------ requests */

  /**
   * Send a request and await the matching response.
   * @param {string} action   ewallet-cli action (check/history/stats/...)
   * @param {object} [payload]
   * @param {number} [timeoutMs]
   */
  request(action, payload = {}, timeoutMs = 30000) {
    if (this.stopped || !this.child) {
      return Promise.reject(new Error('data service is not running'));
    }
    const id = this.nextId++;
    const body = `${JSON.stringify({ id, action, payload })}\n`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`data service timed out (${action}, ${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(body);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`failed to write to data service: ${err.message}`));
      }
    });
  }
}

module.exports = { PythonBridge };
