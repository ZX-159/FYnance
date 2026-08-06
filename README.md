# FYnance

**FYnance** — a premium desktop dashboard for the **Foon Yew (宽柔中学) eschool
e-wallet**. Set your 10-digit card code once in Settings; FYnance **remembers
it and automatically fetches your balance & spending on a schedule as long as
it is running** (even in the system tray). React 19 + Vite frontend with a
distinctive **Noir & Teal** design system (near-black surfaces, deep navy +
teal accents). Ships as a single native installer with **zero Python or
external dependencies** for the end user.

> Data source: `POST https://foonyew.eschool.edu.my/newui/ewallet/chkbal.php`
> with `idcard=<base64(card_id)>` — reverse-engineered and verified live
> (card `0002329052`). The school server only accepts Malaysian/local IPs.

---

## Table of contents

1. [Features](#features)
2. [Multi-language support](#multi-language-support)
3. [Prerequisites](#prerequisites)
4. [Setup & first run (quick)](#setup--first-run-quick)
5. [Detailed setup & compile guide](#detailed-setup--compile-guide)
6. [Development workflow](#development-workflow)
7. [Packaging installers (Windows / macOS / Linux)](#packaging-installers-windows--macos--linux)
8. [Data & storage](#data--storage)
9. [CSV export](#csv-export)
10. [Missing-data recovery (unknown transactions)](#missing-data-recovery-unknown-transactions)
11. [Factory reset](#factory-reset)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Architecture](#architecture)
15. [Security notes](#security-notes)

---

## Features

| Feature | Details |
|---|---|
| **Persistent memory** | Card code, interval, theme, language, behaviour toggles stored in SQLite and reloaded on launch |
| **Automated fetching** | Background scheduler in the main process — configurable interval (5m → daily), overlap-safe, keeps running in the system tray |
| **Multi-language UI** | 🇬🇧 English · 🇨🇳 中文 (简体) · 🇲🇾 Bahasa Melayu — instant switch, locale-aware dates/numbers |
| **Multi-user accounts** | Unlimited profiles — each with its own **name, card ID, card style AND colour theme**. Switch from the sidebar profile chip dropdown; manage everything inline in **Settings → Accounts** |
| **Guided first run** | Zero accounts on launch → a **3-step onboarding wizard** (Welcome → Create account → Done) prompts you to create your first account — no hunting for Settings |
| **Delete = full cleanup** | Deleting an account permanently removes the account AND all its recorded transactions & balance history |
| **Per-profile prefs** | Every account remembers its own flip-card design and theme family; switching accounts swaps the look automatically |
| **Theme families** | 6 accent palettes × dark/light: **FYnance** (sky/lavender), **Midnight** (navy/teal), **Champagne** (obsidian/gold), **Forest** (green/mint), **Sunset** (plum/citrus), **Mono** (graphite) |
| **5 flip-card designs** | Dark · Gold · Sky · Forest · Sunset — chosen **per account** |
| **Battery-saver idle** | Optional "Idle mode": pauses background auto-syncs while the window is hidden in the tray — syncs resume when you open the app. Plus a **max local history** setting with an **Unlimited** option, `backgroundThrottling`, and a lower IPC timeout for lighter memory use |
| **Per-user reset** | "Reset my account data" wipes ONLY the active account (its transactions, balance history, card ID) — other accounts untouched. A separate factory reset clears everything |
| **UI overview** | See `UI_OVERVIEW.md` — full layout maps + redesign decision table |
| **System tray** | Close-to-tray (toggleable), live balance in the tray menu, Sync Now, Quit |
| **Local persistence** | SQLite — appends + deduplicates transactions, one balance point per sync |
| **Missing-data recovery** | Balance-gap reconciliation infers **Unknown (inferred)** transactions: `missing = Δbalance − known spend`; top-ups detected separately |
| **Analytics view** | Monthly stacked bar chart (known vs unknown), spending-by-shop donut, monthly summary table with totals |
| **CSV export** | Transactions, monthly summary, balance history — native save dialog, Excel-safe BOM |
| **Factory reset** | One click wipes ALL data + settings (with confirmation dialog) and returns to first-run state |
| **10 colour themes** | Sage (default) · FYnance · Midnight · Champagne · Forest · Sunset · Mono · **Rose** · **Ocean** · **Ember** — each × dark/light, with **visual palette pickers** in Settings (larger cards showing the family's colour palette) |
| **10 card designs** | Sage · Dark · Gold · Sky · Forest · Sunset · **Rose** · **Ocean** · **Ember** · **Platinum** — chosen per account via **visual card previews** in Settings |
| **Live clock & greeting** | Topbar shows a ticking **HH:MM:SS clock**; the Overview greeting is **time-aware** (Good morning / afternoon / evening, computed from the live clock) |
| **Monthly budget** | Set a **monthly spending limit per account** (Settings → Look of {account}); the pace card measures against it, shows **budget left** and turns **red with "Overspent RM X"** when exceeded. Leave empty = no limit (balance-based pace) |
| **Notification centre** | Signals bell with **Mark all read / Clear all** — the orange unread dot only appears when there are new items, and read-state persists across restarts |
| **Low-balance alert** | Set a per-account alert level (Settings → Look of {account}); the signals bell gets a warning + orange dot when the balance drops to/below it |
| **Next-sync countdown** | The sidebar sync card shows a live "Next sync in 5m 12s" countdown (ticking) |
| **Backup & restore** | Export the whole database to a file, or import a backup — records are merged & deduplicated, profiles with new card IDs are added, and reconciliation adapts automatically (balance pairs are processed chronologically) |
| **Auto-update** | electron-updater wired in (generic provider): packaged builds check for updates, download in the background, and install on quit — your data (in userData) is never touched |
| **System-wide logo** | Sage/lime FY monogram applied to the app icon, tray icons and installer |
| **Organic motion** | Periodic card sheen sweep, staggered panel entrances, breathing pace-ring, spring hover/press on metrics & buttons, animated SVG charts |
| **Redesigned UI** | Reference-inspired, adapted: traffic-light window chrome + collapsible sidebar, eyebrow+title topbar with workspace search (⌘K), **signals bell** with real insights, metric strip, wallet flip panel, **monthly pace ring**, animated **SVG spending-rhythm chart** with hover tooltips, top-category mini bars, ledger table with filter pills, y-axis bar chart, conic donut, insight box, report table, settings rows with theme-preview cards, language pills and storage visual |
| **Reference-design merge** | Greeting header with avatar, 3-column landscape card grid, gradient **Monthly Spending Tracker** (green→yellow→orange + pointer), **Weekly Trend** bars (W1–W4), **spending-by-shop breakdown** % bars, quick stats (weekly trend %, last purchase), sidebar theme toggle |
| **3D flip hero card** | Two selectable styles (Settings → Card style): **Dark flip** (credit-card style with magnetic strip back) and **Gold flip** (champagne gradient) — flips on hover/click, shows the **real card holder name and real 10-digit card number**, student no & class on the back |
| **Demo card privacy** | The onboarding example shows a **randomly generated 10-digit demo number** — your real card ID is only displayed on the hero card and the Settings input |
| **Modern stack** | React 19 + Vite 8 · Electron 43 · electron-builder 26 — 0 audit vulnerabilities |
| **Windows-safe I/O** | Data service forces UTF-8 output — fixes the `'charmap' codec can't encode` crash with Chinese names |

---

## First run (guided)

With **zero accounts**, FYnance opens a full-screen **onboarding wizard**:

1. **Welcome** — what the app does (3 quick points)
2. **Create your first account** — name + 10-digit card ID (demo example shown)
3. **All set** — "Get started" → auto-sync lands you on the Overview

You can "Skip for now" — the Overview then shows a clear **"Create your
account"** button that takes you straight to Settings → Accounts.

## Multi-user accounts

- **Add accounts** (Settings → Accounts section, or the profile chip dropdown
  at the bottom of the sidebar → "Manage accounts"): give each a name + their
  10-digit card ID. The first account becomes active automatically.
- **Switch** from the **sidebar chip dropdown** (click the chip → tap an
  account) — triggers an immediate sync and the whole dashboard (balance,
  history, analytics, charts) follows the active account.
- **Account settings live inside Settings** — the Accounts section is the
  first card: switch / rename / edit card / per-account card style & theme /
  delete, all inline (no separate modal).
- **Per-account look**: each account stores its own **card style** and
  **theme family** — switching accounts swaps the card and colours instantly.
  Edit them in the account's edit panel (pencil icon).
- **Deleting an account also deletes its data** (transactions + balance
  history) — the confirmation explains this clearly. Deleting the active
  account falls back to the most recent one.
- Data is keyed by card ID, so each account's history is automatically
  separated; `stats`/`monthly` always reflect the active account.

## Background / idle memory

- **Idle mode** (Settings → Behaviour): when the window is hidden in the tray,
  background auto-syncs pause. The scheduler re-checks every few minutes
  (cheap) and syncs when you open the app again. Great for laptops/battery.
- **Max local history** (Settings → Behaviour): caps the stored transaction
  archive (default 500) — older records are auto-trimmed after each sync so
  the SQLite file stays small.
- `backgroundThrottling: true` — the hidden renderer's timers/animations are
  throttled by Chromium.
- Lower IPC timeout (30s) so hung requests fail fast instead of piling up.

## Theme families

Settings → Appearance → **Theme** (accent family) + **Mode** (system/light/dark):

| Family | Accent palette |
|---|---|
| FYnance | Sky Blue `#3A96E7` × Lavender Pink `#D8B4F8` |
| Midnight | Deep teal `#2DD4BF` × Navy Blue `#6B8AF7` |
| Champagne | Warm Gold `#E9CD92` × Bronze `#B98F3C` |
| Forest | Emerald `#4ADE80` × Lime `#A3E635` |
| Sunset | Citrus Orange `#FB923C` × Pink `#F472B6` |
| Mono | Graphite `#D1D5DB` × Gray `#6B7280` |

The sidebar / topbar theme toggle flips light ↔ dark within the active family.

## Hero card & demo number

The hero is a **3D flip card** (flips on hover or click):

- **Dark flip card** — near-black `#171717`, chip + contactless icons,
  diagonal magnetic strip + signature strip on the back (Praashoo7-style).
- **Gold flip card** — champagne gradient `#edcb78 → #f7e4b2 → #fee08b`
  with a white top strip (VassoD-style).
- **Sky flip card** — sky-blue → lavender gradient, white strip back.
- **Forest flip card** — deep green gradient, dark diagonal strip back.
- **Sunset flip card** — plum → citrus gradient, white top strip back.
- No mastercard/visa branding — the card is branded **FYnance**.
- **Front:** FYnance brand, chip, contactless, the **real card holder name**
  and the **real 10-digit card number** (grouped `0002 3290 52`), plus a
  "Since MM/YY" stamp from your first recorded balance.
- **Back:** student number, class and the card number.

Choose the style in **Settings → Appearance → Card style** (persisted).

Your real card ID appears on the hero card and in the Settings input only.
The onboarding example shows a **randomly generated 10-digit demo number**
(new each session).

---

## Multi-language support

- **Languages:** English, 简体中文, Bahasa Melayu.
- **Switch:** Settings → Appearance → Language (applies instantly, persisted).
- Dates/amounts use locale-aware formatting (`en-MY`, `zh-CN`, `ms-MY`).
- Everything is localised: navigation, labels, toasts, confirmation dialogs,
  empty states, time-ago strings, export names.

---

## Prerequisites

| Requirement | Version | Needed for |
|---|---|---|
| **Node.js** (includes npm) | **≥ 22 LTS** | building & running the app |
| **Python 3** | **≥ 3.9** | building the native data-service binary (end users don't need it) |
| PyInstaller | auto-installed | Python binary packaging |

> **End users do NOT need Node or Python** — installers bundle everything.

---

## Setup & first run (quick)

The repo ships as **pure source (~500 KB)** — no installed packages, no build
artifacts:

```bash
# 1. install Node ≥ 22, then:
cd fynance

# 2. install dependencies
npm install

# 3. build (Vite renderer + PyInstaller binary) — ~1-2 min first time
npm run build

# 4. launch
npm start
```

Then: **Settings → enter your 10-digit card ID → Save & sync now.**

> Generated folders (`node_modules/`, `dist/`, `build/`, `python/dist/`,
> `release/`) are git-ignored and excluded from workspace snapshots — run
> `npm run build` after a fresh clone to regenerate them.

---

## Detailed setup & compile guide

### Step 1 — Install Node.js

- **Windows:** https://nodejs.org LTS installer (or `winget install OpenJS.NodeJS.LTS`).
  Verify: `node --version` (v22+), `npm --version`.
- **macOS:** `brew install node`.
- **Linux (Debian/Ubuntu):** `sudo apt install -y nodejs npm`, or use nvm:
  `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install --lts`.

Python (build only): `python3 --version` (≥ 3.9; Windows: `python --version`).

### Step 2 — Install the dependencies

```bash
cd fynance
npm install
```

> **If you ever see `ERESOLVE unable to resolve dependency tree`:** the
> toolchain is pinned (`vite ^8.2.0` + `@vitejs/plugin-react ^5.2.0` + react 19
> + electron ^43 + electron-builder ^26). Fix properly, not with `--force`:
> ```bash
> rm -rf node_modules package-lock.json
> npm install
> ```

### Step 3 — Build

```bash
npm run build        # renderer (Vite) + Python binary (PyInstaller)
```

| Command | What it does | Output |
|---|---|---|
| `npm run build:renderer` | Vite production build of the React UI | `dist/` |
| `npm run build:python` | PyInstaller single-file build | `python/dist/ewallet-cli` (`.exe` on Windows) |

The Python binary must be built **on the target OS** (PyInstaller is not
cross-compiling). Source is stdlib-only — no hidden imports.

### Step 4 — Run

```bash
npm start                 # builds (if needed) then launches Electron
npm run start:quick       # launch without rebuilding
```

**At launch:** Electron spawns the data service → loads saved settings →
if a card ID is saved (and "Sync on launch" is on) it syncs immediately →
schedules the next sync. Closing the window hides to the tray (toggleable).

### Step 5 — First-run configuration

Settings → **Card ID** (10-digit zero-padded number on your e-wallet card,
e.g. `0002329052` — *not* the barcode value) → interval → appearance →
**language** → behaviour toggles → **Save & sync now**.

> ⚠️ The school server only accepts **Malaysian/local IPs** (geo-blocks
> foreign data-center IPs). Run the app from a Malaysian connection.

---

## Development workflow

```bash
# terminal 1 — Vite dev server (hot reload)
npm run dev:renderer

# terminal 2 — Electron pointed at the dev server
npm run start:quick -- --dev
```

`main.js` loads `http://localhost:5173` in `--dev` mode, `dist/index.html`
otherwise. Renderer has no other network access (strict CSP).

---

## Packaging installers (Windows / macOS / Linux)

### What `npm run dist:win` produces (and what each file is for)

```
release/
├── FYnance Setup 1.0.0.exe      ← the INSTALLER — this is what you give to users
└── win-unpacked/                ← the raw, UNINSTALLED app folder
    ├── FYnance.exe              ← the app binary
    ├── *.dll, *.pak, locales/…  ← Electron runtime files (needed by the app)
    └── resources/
        ├── app.asar             ← your UI code (renderer + main)
        └── python/ewallet-cli.exe ← the bundled data service
```

> ⚠️ **Do NOT run `FYnance.exe` from `win-unpacked` directly** — that folder is
> just the intermediate build output. The proper way to run the app is to
> install it with **`FYnance Setup 1.0.0.exe`** (the NSIS installer), which
> creates a Start-Menu / desktop shortcut. The installer is a single clean
> package; `win-unpacked` is only there for testing/debugging.

### If the unpacked `.exe` "won't open"

The most common cause: **running `npm run dist:win` without first building the
renderer and Python binary** (they're git-ignored and cleaned between
sessions). The old `dist:win` script did **not** build them — it just ran
electron-builder, so the package shipped with an empty `app.asar` (no UI) and
no `resources/python/ewallet-cli.exe` (no data service) → the app opens a
blank window or crashes immediately.

**Fixed:** `dist:*` scripts now run `npm run build` (renderer + Python binary)
first, so this can't happen again:

```bash
npm run dist:win     # builds renderer + python binary, then packages NSIS
```

**Manual sanity check before packaging** (should all pass):
```bash
npm run build:renderer            # → dist/ has index.html + assets
node scripts/build-python.js      # → python/dist/ewallet-cli(.exe)
./python/dist/ewallet-cli --help  # binary runs
```

Build **on the target OS**:


Build **on the target OS**:

| Target | Command | Installer output |
|---|---|---|
| Windows x64 | `npm run dist:win` | `release/FYnance Setup 1.0.0.exe` (NSIS) — run the installer, not the unpacked exe |
| macOS | `npm run dist:mac` | `release/FYnance-1.0.0.dmg` |
| Linux | `npm run dist:linux` | `release/FYnance-1.0.0.AppImage` |
| Unpacked dir (debug) | `npm run dist:dir` | `release/<os>-unpacked/` |

The Python binary is bundled into `resources/python/` via `extraResources`;
the bridge resolves it from `process.resourcesPath` when packaged. The end
user installs/runs **one file** — nothing else to install.

---

## Data & storage

SQLite at `app.getPath('userData')/fynance.db`:

| Table | Purpose |
|---|---|
| `transactions` | archived spending rows; unique index → dedup |
| `balance_history` | one row per successful sync → trend + reconciliation |
| `settings` | card ID, interval, theme, **language**, behaviour toggles |

---

## CSV export

Native save dialog, UTF-8 BOM (Excel-safe):
- **Transactions CSV** — `date, shop, description, quantity, unit_price,
  total_rm, type, first_seen_at` (`known` / `inferred-unknown`).
- **Monthly summary CSV** — per-month + TOTAL row.
- **Balance history CSV** — `fetched_at, balance_rm`.

---

## Missing-data recovery (unknown transactions)

```
for each consecutive balance pair A → B:
    expected_spend = bal(A) − bal(B)          # +ve = net spending
    known_spend    = Σ recorded transactions with A < fetched_at ≤ B
    missing        = expected_spend − known_spend
    if missing > RM0.005  → inferred "Unknown (inferred)" row
    if expected_spend < 0 → recorded as a top-up
```

Inferred rows are generated on the fly (never written to the DB), flagged
`inferred: true`, and appear in History (amber **unknown** badge), Analytics,
monthly summaries, and CSV exports.

---

## Factory reset

Settings → **Danger zone → Reset database**:

1. A confirmation dialog explains everything will be erased.
2. Confirm → the Python service deletes all transactions, balance history
   and settings; the UI returns to first-run (onboarding) state.
3. This cannot be undone — there is no second chance prompt.

---

## Testing

```bash
# 1. offline mock of chkbal.php (terminal 1):
MOCK_VALID_IDS=0002329052 python3 scripts/mock_server.py

# 2. bridge integration test (terminal 2):
node test-bridge.js
```

Covers: spawn/resolution → ping → check (fetch+persist) → dedup → typed
errors → stats → settings persistence across restart (incl. language and
behaviour toggles).

---

## Updating & data preservation

**How updates keep your data:** all your data lives in the OS app-data folder
(`%APPDATA%/FYnance`, `~/Library/Application Support/FYnance`,
`~/.config/FYnance`) — it is **independent of the app files**. Reinstalling or
updating FYnance never touches it, and the built-in schema migration
(`_migrate`) adds any new columns automatically on first launch.

**Automatic updates (packaged builds):**
1. `package.json` wires **electron-updater** with a generic provider — point
   `build.publish[0].url` at your release host (or use GitHub Releases).
2. Publish each release with `npm run dist:update` (builds + NSIS + `latest.yml`).
3. Installed apps check on startup, download in the background
   ("Update available"), and install on quit ("Update downloaded").

**Manual update (no code work):** users just download the new installer and
run it — electron-builder installs over the old version; data + settings are
preserved and the schema adapts on next launch. No `npm install`/`build` on
the user's machine, ever.

**Backup & restore (belt & braces):** Settings → Data & storage →
Export backup / Import backup — a full SQLite file export, and a merging
import (dedupe + auto-adapt).

## GitHub distribution

See **`DEPLOY_GUIDE.md`** for the full walkthrough. TL;DR:

1. Push the repo to GitHub (`.gitignore` keeps it source-only).
2. Set `build.publish.owner` to your GitHub username.
3. Tag a release: `git tag v1.8.0 && git push origin main --tags`
4. The included GitHub Action builds Windows/macOS/Linux installers and
   publishes them to a GitHub Release automatically.
5. Users' apps auto-update from that release channel (or via
   Settings → About & updates → **Check for updates**).

Data is never touched by updates — it lives in the OS app-data folder, and
new versions migrate the schema on first launch.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm error ERESOLVE` | Stale lockfile — `rm -rf node_modules package-lock.json && npm install` (avoid `--force`). |
| `Error: libnss3.so ...` (Linux) | `sudo apt install -y libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libgtk-3-0t64`. |
| AppImage won't start | Distro lacks FUSE: `./FYnance-1.0.0.AppImage --appimage-extract-and-run` or install `libfuse2`. |
| "Cannot reach the school server" | You're outside Malaysia — the school server geo-blocks foreign IPs. |
| "Card ID not recognised" | Use the 10-digit zero-padded card number, **not** the barcode value. |
| "Data service not found" in packaged app | Run `npm run build:python` before `npm run dist`. |
| App keeps running after closing the window | Close-to-tray is on — quit from the tray menu or disable in Settings → Behaviour. |
| Language didn't change | It applies instantly; if you're on the Settings screen, re-open it after switching (state hydrates from saved settings). |

---

## Architecture

```
┌────────────── React 19 + Vite renderer (src-renderer/) ─────────────────────┐
│  Sidebar · Topbar · Overview · History · Analytics · Settings · Toasts     │
│  i18n (en/zh-CN/ms) · canvas charts (zero deps) · strict CSP                │
└───────────────▲───────────────────────────────▲─────────────────────────────┘
                │ window.api (contextBridge)    │ state:update (pushed events)
┌───────────────┴───────────────────────────────┴─────────────────────────────┐
│  Electron main (electron/main.js)                                           │
│   • system tray · scheduler (overlap-safe, tray-friendly)                   │
│   • app state + IPC (sync, history, stats, monthly, CSV export, reset)      │
└───────────────▲─────────────────────────────────────────────────────────────┘
                │ JSON lines over stdio (id-matched, 60s timeouts)
┌───────────────┴─────────────────────────────────────────────────────────────┐
│  PythonBridge (electron/python-bridge.js)                                   │
│   packaged → resources/python/ewallet-cli(.exe) · dev → python/dist/…       │
└───────────────▲─────────────────────────────────────────────────────────────┘
┌───────────────┴─────────────────────────────────────────────────────────────┐
│  ewallet-cli (python/ewallet_cli.py v1.2.0 → PyInstaller single binary)     │
│   • fetch/parse chkbal.php (gbk → JSON) · SQLite · reconciliation · monthly │
│   • settings (incl. language) · factory reset                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Actions: `ping`, `check`, `history`, `balance_history`, `stats`, `monthly`,
`reconcile`, `settings_get`, `settings_set`, `reset`. Errors carry a `kind`
(`network`, `notfound`, `parse`, `db`, `badrequest`).

---

## Security notes

* Renderer sandboxed (`contextIsolation`, `sandbox`, no `nodeIntegration`,
  strict CSP — no remote content/fonts).
* Server strings rendered via React (auto-escaped); inferred rows are
  estimates, always labelled, never written to the archive.
* The only network call is the card-authenticated balance query; history and
  settings live in the local SQLite file.

---

### Additional notes

*This project is not affiliated to Eschools or Foon Yew High School. 
*This project is provided as-is, use at your own risk. 

---
