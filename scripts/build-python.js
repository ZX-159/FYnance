'use strict';
/**
 * scripts/build-python.js — cross-platform PyInstaller build.
 * Works on Windows, macOS and Linux from one script (replaces build.sh/.bat).
 *
 * Usage:  node scripts/build-python.js
 * Output: python/dist/ewallet-cli   (ewallet-cli.exe on Windows)
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PY = process.platform === 'win32' ? 'python' : 'python3';

function run(cmd, args, opts = {}) {
  console.log(`\n[build-python] $ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.status !== 0) {
    console.error(`\n[build-python] FAILED (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

// 1) ensure PyInstaller
run(PY, ['-m', 'pip', 'install', '--quiet', 'pyinstaller']);

// 2) clean previous build
const dist = path.join(ROOT, 'python', 'dist');
fs.rmSync(dist, { recursive: true, force: true });

// 3) compile single-file binary
run(PY, [
  '-m', 'PyInstaller',
  '--onefile',
  '--clean',
  '--name', 'ewallet-cli',
  '--distpath', path.join('python', 'dist'),
  '--workpath', path.join('build', 'pyinstaller-work'),
  '--specpath', path.join('build'),
  path.join('python', 'ewallet_cli.py'),
]);

// 4) report
const exe = process.platform === 'win32' ? 'ewallet-cli.exe' : 'ewallet-cli';
const out = path.join(dist, exe);
if (!fs.existsSync(out)) {
  console.error(`[build-python] expected output missing: ${out}`);
  process.exit(1);
}
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`\n[build-python] OK — ${out} (${mb} MB)`);
