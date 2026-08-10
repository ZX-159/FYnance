#!/usr/bin/env python3
"""
ewallet_cli.py — Foon Yew eSchool e-Wallet data service (STDLIB ONLY).

A line-delimited JSON-RPC bridge over stdio, designed to be compiled with
PyInstaller into a single native binary and spawned by the Electron main
process. Zero third-party Python dependencies.

Protocol
--------
Each line on stdin:   {"id": <int>, "action": "<name>", "payload": {...}}
Each line on stdout:  {"id": <int>, "ok": true,  "data": {...}}
                      {"id": <int>, "ok": false, "error": "...", "kind": "..."}

Actions
-------
  ping              -> {"version": ..., "python": ..., "db": ...}
  check             -> fetch balance/particulars/last-3-transactions for a card
                       ID, persist the snapshot, return data + persist counts
  history           -> recorded transactions (deduplicated archive) PLUS
                       inferred "unknown" rows from balance-gap reconciliation
  balance_history   -> recorded balance points (for the trend chart)
  stats             -> aggregates: tx count, total spent, current balance, ...
  monthly           -> per-month summary: known/unknown spent, top-ups,
                       balance start/end (for charts & reports)
  settings_get      -> stored settings (card_id, interval_minutes, theme)
  settings_set      -> update stored settings

Reconciliation ("unknown transactions")
--------------------------------------
The kiosk only ever shows the last 3 transactions. If a student makes more
than 3 purchases between two syncs, some transactions are never captured.
We detect the gap with arithmetic: for consecutive balance records A -> B,
  expected_spend = bal(A) - bal(B)          (positive = net spending)
  known_spend    = sum of recorded transactions between A and B
  missing        = expected_spend - known_spend
If missing > RM0.005 a synthetic "unknown transaction" row is generated
(marked inferred:true) and included in history/monthly/CSV outputs.
Negative expected_spend (balance rising) is recorded as a top-up.

Error kinds: network | notfound | parse | db | badrequest | internal

Usage:
  ewallet_cli.py --db <sqlite-path> [--url <endpoint-url>]
"""
import argparse
import base64
import datetime as dt
import json
import os
import re
import sqlite3
import sys
import traceback
import urllib.error
import urllib.parse
import urllib.request

VERSION = "1.8.0"

DEFAULT_URL = "https://foonyew.eschool.edu.my/newui/ewallet/chkbal.php"
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")

# --------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------

def b64(s: str) -> str:
    """Base64-encode exactly like the kiosk page's base64.js."""
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


class FetchError(Exception):
    def __init__(self, message, kind="network"):
        super().__init__(message)
        self.kind = kind


def fetch_balance_page(card_id: str, url: str = DEFAULT_URL, timeout: int = 30) -> str:
    """POST idcard=<b64(card_id)> to chkbal.php, return decoded (gbk) HTML."""
    body = urllib.parse.urlencode({
        "status": "1",
        "cc": "",
        "hist_idcard": "",
        "idcard": b64(card_id),
    })
    req = urllib.request.Request(url, data=body.encode("utf-8"), method="POST", headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": url,
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        raise FetchError(f"server returned HTTP {e.code}", "network") from e
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        raise FetchError(f"cannot reach server: {reason}", "network") from e
    except OSError as e:
        raise FetchError(f"network error: {e}", "network") from e
    return raw.decode("gb18030", errors="replace")


def parse_balance_page(html: str) -> dict:
    """Parse the populated chkbal.php response (same selectors as the UI)."""
    inputs = re.findall(
        r"<input[^>]*type=['\"]text['\"][^>]*readonly[^>]*value=['\"]([^'\"]*)['\"]",
        html, re.I | re.S)
    if len(inputs) < 3:
        inputs = re.findall(
            r"<input[^>]*readonly[^>]*type=['\"]text['\"][^>]*value=['\"]([^'\"]*)['\"]",
            html, re.I | re.S)

    balance = ""
    m = re.search(r"font-size:\s*32pt;\"\s*>\s*([^<]*?)\s*<", html, re.I)
    if m:
        balance = m.group(1).strip()

    transactions = []
    m = re.search(r"最后3笔交易记录(.*?)</table>", html, re.S)
    if m:
        tm = re.search(r"<tbody[^>]*>(.*?)</tbody>", m.group(1), re.S)
        body = tm.group(1) if tm else m.group(1)
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if cells and any(cells):
                transactions.append(cells)

    name = inputs[0].strip() if len(inputs) > 0 else ""
    return {
        "name": name,
        "student_no": inputs[1].strip() if len(inputs) > 1 else "",
        "department_class": inputs[2].strip() if len(inputs) > 2 else "",
        "balance_rm": balance,
        "last_transactions": transactions,
    }


def _to_float(s):
    try:
        return float(re.sub(r"[^0-9.\-]", "", s or ""))
    except (ValueError, TypeError):
        return None


def build_snapshot(card_id: str, html: str) -> dict:
    """Parsed page -> clean JSON snapshot."""
    data = parse_balance_page(html)
    if not data.get("name"):
        raise FetchError("card ID not recognised by the school server "
                         "(no student data returned)", "notfound")
    txs = []
    for cells in data["last_transactions"]:
        padded = (cells + [""] * 6)[:6]
        txs.append({
            "date": padded[0],
            "shop": padded[1],
            "description": padded[2],
            "quantity": padded[3],
            "unit_price": padded[4],
            "total": padded[5],
        })
    return {
        "card_id": card_id,
        "fetched_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "name": data["name"],
        "student_no": data["student_no"],
        "department_class": data["department_class"],
        "balance_rm": data["balance_rm"],
        "balance_value": _to_float(data["balance_rm"]),
        "transactions": txs,
    }


# --------------------------------------------------------------------------
# Persistence (SQLite, stdlib)
# --------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at  TEXT NOT NULL,
    card_id     TEXT NOT NULL,
    date        TEXT NOT NULL DEFAULT '',
    shop        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    quantity    TEXT NOT NULL DEFAULT '',
    unit_price  TEXT NOT NULL DEFAULT '',
    total       TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction
    ON transactions(card_id, date, shop, description, quantity, total);

CREATE TABLE IF NOT EXISTS balance_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at       TEXT NOT NULL,
    card_id          TEXT NOT NULL,
    balance_rm       TEXT NOT NULL,
    balance_value    REAL,
    name             TEXT NOT NULL DEFAULT '',
    student_no       TEXT NOT NULL DEFAULT '',
    department_class TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL DEFAULT '',
    card_id       TEXT NOT NULL DEFAULT '',
    card_style    TEXT NOT NULL DEFAULT '',
    theme_family  TEXT NOT NULL DEFAULT '',
    monthly_budget TEXT NOT NULL DEFAULT '',
    low_balance_threshold TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL,
    last_used     TEXT NOT NULL DEFAULT ''
);
"""

DEFAULT_SETTINGS = {
    "card_id": "",
    "interval_minutes": "60",
    "theme": "system",
    "language": "en",
    "sync_on_launch": "1",
    "minimize_to_tray": "1",
    "card_style": "flip-sage",
    "theme_family": "sage",
    "active_profile": "",
    "monthly_budget": "",
    "low_balance_threshold": "",
    "update_mode": "auto",
}


def _migrate(conn):
    """Add columns introduced after the initial schema (existing installs)."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(profiles)")}
    for _col in ("monthly_budget", "low_balance_threshold"):
        if _col not in cols:
            conn.execute(f"ALTER TABLE profiles ADD COLUMN {_col} TEXT NOT NULL DEFAULT ''")
    conn.commit()


_DB_PATH = ""


def init_db(db_path: str) -> sqlite3.Connection:
    global _DB_PATH
    _DB_PATH = db_path
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    try:
        _migrate(conn)
    except Exception as e:  # noqa: BLE001
        _log(f"migration skipped: {e}")
    conn.commit()
    return conn


def append_snapshot(conn, snapshot: dict) -> dict:
    now = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    cur = conn.execute(
        "INSERT INTO balance_history (fetched_at, card_id, balance_rm, balance_value,"
        " name, student_no, department_class) VALUES (?,?,?,?,?,?,?)",
        (now, snapshot["card_id"], snapshot["balance_rm"], snapshot["balance_value"],
         snapshot["name"], snapshot["student_no"], snapshot["department_class"]))
    balance_id = cur.lastrowid
    added = 0
    for tx in snapshot["transactions"]:
        cur = conn.execute(
            "INSERT OR IGNORE INTO transactions (fetched_at, card_id, date, shop,"
            " description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?,?)",
            (now, snapshot["card_id"], tx["date"], tx["shop"], tx["description"],
             tx["quantity"], tx["unit_price"], tx["total"]))
        added += cur.rowcount
    conn.commit()
    return {"balance_recorded": balance_id is not None, "transactions_added": added}


def query_history(conn, card_id: str, limit: int = 500):
    rows = conn.execute(
        "SELECT date, shop, description, quantity, unit_price, total, fetched_at"
        " FROM transactions WHERE card_id = ? ORDER BY date DESC, id DESC LIMIT ?",
        (card_id, limit)).fetchall()
    return [dict(r) for r in rows]


def query_balance_history(conn, card_id: str, limit: int = 120):
    rows = conn.execute(
        "SELECT fetched_at, balance_value, balance_rm FROM balance_history"
        " WHERE card_id = ? ORDER BY id DESC LIMIT ?", (card_id, limit)).fetchall()
    return [dict(r) for r in rows][::-1]


def compute_stats(conn, card_id: str):
    tx = conn.execute(
        "SELECT COUNT(*) AS n FROM transactions WHERE card_id = ?", (card_id,)).fetchone()
    totals = conn.execute(
        "SELECT total FROM transactions WHERE card_id = ?", (card_id,)).fetchall()
    total_spent = sum(_to_float(r["total"]) or 0 for r in totals)
    latest = conn.execute(
        "SELECT balance_rm, balance_value, name, student_no, department_class,"
        " fetched_at FROM balance_history WHERE card_id = ? ORDER BY id DESC LIMIT 1",
        (card_id,)).fetchone()
    first = conn.execute(
        "SELECT MIN(fetched_at) AS f FROM balance_history WHERE card_id = ?",
        (card_id,)).fetchone()
    recon = reconcile(conn, card_id)
    unknown_total = round(sum(r["total_value"] for r in recon["inferred"]), 2)
    topup_total = round(sum(r["amount"] for r in recon["topups"]), 2)
    try:
        sz = conn.execute(
            "SELECT page_count * page_size AS s FROM pragma_page_count(), pragma_page_size()"
        ).fetchone()
        db_bytes = sz["s"] if sz else 0
    except Exception:
        db_bytes = 0
    return {
        "db_bytes": db_bytes,
        "transaction_count": tx["n"] if tx else 0,
        "total_spent": round(total_spent, 2),
        "unknown_total": unknown_total,
        "topup_total": topup_total,
        "total_spent_incl_unknown": round(total_spent + unknown_total, 2),
        "current_balance": (latest["balance_value"] if latest else None),
        "current_balance_rm": (latest["balance_rm"] if latest else ""),
        "name": (latest["name"] if latest else ""),
        "student_no": (latest["student_no"] if latest else ""),
        "department_class": (latest["department_class"] if latest else ""),
        "first_recorded": (first["f"] if first and first["f"] else None),
        "last_recorded": (latest["fetched_at"] if latest else None),
    }


# --------------------------------------------------------------------------
# Reconciliation (balance-gap -> unknown transactions)
# --------------------------------------------------------------------------

def reconcile(conn, card_id: str) -> dict:
    """Compare consecutive balance points with recorded transactions and
    infer missing spending (unknown transactions) and top-ups."""
    bals = conn.execute(
        "SELECT fetched_at, balance_value FROM balance_history"
        " WHERE card_id = ? ORDER BY fetched_at ASC, id ASC", (card_id,)).fetchall()
    txs = conn.execute(
        "SELECT fetched_at, total FROM transactions WHERE card_id = ?"
        " ORDER BY fetched_at ASC", (card_id,)).fetchall()

    inferred, topups = [], []
    for a, b in zip(bals, bals[1:]):
        if a["balance_value"] is None or b["balance_value"] is None:
            continue
        net = a["balance_value"] - b["balance_value"]   # + = net spending
        known = sum(_to_float(t["total"]) or 0 for t in txs
                    if a["fetched_at"] < t["fetched_at"] <= b["fetched_at"])
        if net > 0.005:
            missing = net - known
            if missing > 0.005:
                inferred.append({
                    "date": b["fetched_at"][:10],
                    "month": b["fetched_at"][:7],
                    "shop": "Unknown (inferred)",
                    "description": "Missing transaction(s) — balance gap",
                    "quantity": "",
                    "unit_price": f"{missing:.2f}",
                    "total": f"{missing:.2f}",
                    "total_value": round(missing, 2),
                    "inferred": True,
                    "fetched_at": b["fetched_at"],
                })
        elif net < -0.005:
            topups.append({
                "date": b["fetched_at"][:10],
                "month": b["fetched_at"][:7],
                "amount": round(-net, 2),
                "fetched_at": b["fetched_at"],
            })
    return {"inferred": inferred, "topups": topups}


def history_with_inferred(conn, card_id: str, limit: int = 500):
    rows = query_history(conn, card_id, limit)
    inferred = reconcile(conn, card_id)["inferred"]
    merged = rows + inferred
    merged.sort(key=lambda r: (r.get("date") or ""), reverse=True)
    return merged[:limit] if limit else merged


def monthly_summary(conn, card_id: str) -> dict:
    txs = conn.execute(
        "SELECT date, total FROM transactions WHERE card_id = ?", (card_id,)).fetchall()
    bals = conn.execute(
        "SELECT fetched_at, balance_value FROM balance_history WHERE card_id = ?"
        " ORDER BY fetched_at ASC, id ASC", (card_id,)).fetchall()
    recon = reconcile(conn, card_id)

    def month_of(s):
        return s[:7] if re.match(r"^\d{4}-\d{2}", s or "") else "other"

    months = {}
    for t in txs:
        k = month_of(t["date"])
        m = months.setdefault(k, {"month": k, "known_total": 0.0, "unknown_total": 0.0,
                                  "topup_total": 0.0, "tx_count": 0, "unknown_count": 0,
                                  "topup_count": 0, "start_balance": None, "end_balance": None})
        m["known_total"] += _to_float(t["total"]) or 0
        m["tx_count"] += 1
    for i in recon["inferred"]:
        m = months.setdefault(i["month"], {"month": i["month"], "known_total": 0.0,
                                           "unknown_total": 0.0, "topup_total": 0.0,
                                           "tx_count": 0, "unknown_count": 0,
                                           "topup_count": 0, "start_balance": None,
                                           "end_balance": None})
        m["unknown_total"] += i["total_value"]
        m["unknown_count"] += 1
    for t in recon["topups"]:
        m = months.setdefault(t["month"], {"month": t["month"], "known_total": 0.0,
                                           "unknown_total": 0.0, "topup_total": 0.0,
                                           "tx_count": 0, "unknown_count": 0,
                                           "topup_count": 0, "start_balance": None,
                                           "end_balance": None})
        m["topup_total"] += t["amount"]
        m["topup_count"] += 1
    # first/last balance per month
    seen_first = set()
    for b in bals:
        k = month_of(b["fetched_at"])
        if k not in months or b["balance_value"] is None:
            continue
        if months[k]["start_balance"] is None:
            months[k]["start_balance"] = round(b["balance_value"], 2)
        months[k]["end_balance"] = round(b["balance_value"], 2)

    out = []
    for k in sorted(months, reverse=True):
        m = months[k]
        m["known_total"] = round(m["known_total"], 2)
        m["unknown_total"] = round(m["unknown_total"], 2)
        m["topup_total"] = round(m["topup_total"], 2)
        m["total_spent"] = round(m["known_total"] + m["unknown_total"], 2)
        m["net_change"] = (round((m["end_balance"] or 0) - (m["start_balance"] or 0), 2)
                           if m["start_balance"] is not None else None)
        out.append(m)

    totals = {
        "known_total": round(sum(m["known_total"] for m in out), 2),
        "unknown_total": round(sum(m["unknown_total"] for m in out), 2),
        "topup_total": round(sum(m["topup_total"] for m in out), 2),
        "total_spent": round(sum(m["total_spent"] for m in out), 2),
        "tx_count": sum(m["tx_count"] for m in out),
        "unknown_count": sum(m["unknown_count"] for m in out),
    }
    return {"months": out, "totals": totals}


def get_settings(conn) -> dict:
    out = dict(DEFAULT_SETTINGS)
    for r in conn.execute("SELECT key, value FROM settings"):
        out[r["key"]] = r["value"]
    return out


def set_settings(conn, patch: dict) -> dict:
    allowed = set(DEFAULT_SETTINGS)
    for k, v in (patch or {}).items():
        if k in allowed:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)"
                " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, str(v)))
    # keep the active profile's card_id in sync with the plain card_id setting
    if "card_id" in (patch or {}):
        ap = get_settings(conn).get("active_profile") or ""
        if ap:
            conn.execute("UPDATE profiles SET card_id = ? WHERE id = ?",
                         (str(patch["card_id"]), int(ap) if ap.isdigit() else -1))
    conn.commit()
    return get_settings(conn)


# --------------------------------------------------------------------------
# Profiles (multi-user)
# --------------------------------------------------------------------------

def _now():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def profile_list(conn):
    rows = conn.execute(
        "SELECT id, name, card_id, card_style, theme_family, monthly_budget,"
        " low_balance_threshold, created_at, last_used FROM profiles"
        " ORDER BY last_used DESC, id DESC").fetchall()
    return [dict(r) for r in rows]


def _apply_profile_prefs(conn, pid):
    """When a profile becomes active, its per-profile card style, theme
    family and monthly budget take effect (falling back to globals)."""
    row = conn.execute(
        "SELECT card_style, theme_family, monthly_budget, low_balance_threshold"
        " FROM profiles WHERE id = ?", (pid,)).fetchone()
    if not row:
        return
    patch = {}
    if (row["card_style"] or "").strip():
        patch["card_style"] = row["card_style"]
    if (row["theme_family"] or "").strip():
        patch["theme_family"] = row["theme_family"]
    patch["monthly_budget"] = row["monthly_budget"] or ""
    patch["low_balance_threshold"] = row["low_balance_threshold"] or ""
    set_settings(conn, patch)


def _set_active(conn, pid):
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('active_profile', ?)"
        " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (str(pid),))
    row = conn.execute("SELECT card_id FROM profiles WHERE id = ?", (pid,)).fetchone()
    if row:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('card_id', ?)"
            " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (row["card_id"],))
    conn.commit()
    _apply_profile_prefs(conn, pid)


def profile_add(conn, name, card_id, card_style=None, theme_family=None, monthly_budget=None,
                low_balance_threshold=None):
    name = (name or "").strip() or f"Account {conn.execute('SELECT COUNT(*) FROM profiles').fetchone()[0] + 1}"
    card_id = (card_id or "").strip()
    now = _now()
    cur = conn.execute(
        "INSERT INTO profiles (name, card_id, card_style, theme_family, monthly_budget,"
        " low_balance_threshold, created_at, last_used) VALUES (?,?,?,?,?,?,?,?)",
        (name, card_id, card_style or "", theme_family or "", monthly_budget or "",
         low_balance_threshold or "", now, now))
    _set_active(conn, cur.lastrowid)
    return {"profiles": profile_list(conn), "settings": get_settings(conn)}


def profile_update(conn, pid, name=None, card_id=None, card_style=None, theme_family=None,
                    monthly_budget=None, low_balance_threshold=None):
    pid = int(pid)
    if name is not None:
        conn.execute("UPDATE profiles SET name = ? WHERE id = ?", (str(name).strip(), pid))
    if card_id is not None:
        conn.execute("UPDATE profiles SET card_id = ? WHERE id = ?", (str(card_id).strip(), pid))
    if card_style is not None:
        conn.execute("UPDATE profiles SET card_style = ? WHERE id = ?", (str(card_style).strip(), pid))
    if theme_family is not None:
        conn.execute("UPDATE profiles SET theme_family = ? WHERE id = ?", (str(theme_family).strip(), pid))
    if monthly_budget is not None:
        conn.execute("UPDATE profiles SET monthly_budget = ? WHERE id = ?",
                     (str(monthly_budget).strip(), pid))
    if low_balance_threshold is not None:
        conn.execute("UPDATE profiles SET low_balance_threshold = ? WHERE id = ?",
                     (str(low_balance_threshold).strip(), pid))
    # if we edited the ACTIVE profile, re-apply its prefs immediately
    ap = get_settings(conn).get("active_profile") or ""
    if ap == str(pid):
        _set_active(conn, pid)
    conn.commit()
    return {"profiles": profile_list(conn), "settings": get_settings(conn)}


def profile_delete(conn, pid):
    """Delete a profile AND all data recorded for its card ID."""
    pid = int(pid)
    row = conn.execute("SELECT card_id FROM profiles WHERE id = ?", (pid,)).fetchone()
    tx = bh = 0
    if row and row["card_id"]:
        tx = conn.execute("DELETE FROM transactions WHERE card_id = ?",
                          (row["card_id"],)).rowcount
        bh = conn.execute("DELETE FROM balance_history WHERE card_id = ?",
                          (row["card_id"],)).rowcount
    conn.execute("DELETE FROM profiles WHERE id = ?", (pid,))
    ap = get_settings(conn).get("active_profile") or ""
    if ap == str(pid):
        remaining = profile_list(conn)
        if remaining:
            _set_active(conn, remaining[0]["id"])
        else:
            conn.execute("DELETE FROM settings WHERE key IN ('active_profile','card_id')")
            conn.commit()
    conn.commit()
    return {"profiles": profile_list(conn), "settings": get_settings(conn),
            "transactions_deleted": tx, "balances_deleted": bh}


def reset_own(conn, pid):
    """Wipe ONLY one profile's data (transactions + balance history for its
    card) and its own config (card ID + prefs). Other accounts untouched."""
    row = conn.execute("SELECT id, card_id FROM profiles WHERE id = ?", (pid,)).fetchone()
    tx = bh = 0
    if row and row["card_id"]:
        card = row["card_id"]
        tx = conn.execute("DELETE FROM transactions WHERE card_id = ?", (card,)).rowcount
        bh = conn.execute("DELETE FROM balance_history WHERE card_id = ?", (card,)).rowcount
        # clear the global card_id + per-profile prefs if this was active
        cur = get_settings(conn)
        if cur.get("card_id") == card:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('card_id', '')"
                " ON CONFLICT(key) DO UPDATE SET value = ''")
            for _k in ("card_style", "theme_family", "monthly_budget", "low_balance_threshold"):
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, '')"
                    " ON CONFLICT(key) DO UPDATE SET value = ''", (_k,))
    if row:
        conn.execute(
            "UPDATE profiles SET card_id = '', card_style = '', theme_family = '',"
            " monthly_budget = '', low_balance_threshold = '' WHERE id = ?", (pid,))
    conn.commit()
    return {"transactions_deleted": tx, "balances_deleted": bh,
            "profiles": profile_list(conn), "settings": get_settings(conn)}


def profile_activate(conn, pid):
    pid = int(pid)
    conn.execute("UPDATE profiles SET last_used = ? WHERE id = ?", (_now(), pid))
    _set_active(conn, pid)
    return {"profiles": profile_list(conn), "settings": get_settings(conn)}


# --------------------------------------------------------------------------
# Backup & restore (export/import with merge + adaptation)
# --------------------------------------------------------------------------

def backup_export(conn):
    """Return the whole SQLite database as base64 (for a backup file)."""
    try:
        conn.commit()
        with open(_DB_PATH, "rb") as f:
            raw = f.read()
    except Exception as e:  # noqa: BLE001
        raise FetchError(f"backup export failed: {e}", "db") from e
    return {"file_name": os.path.basename(_DB_PATH), "size": len(raw),
            "data_b64": base64.b64encode(raw).decode("ascii")}


def backup_import(conn, data_b64):
    """Merge a backup database into the current one (via a separate reader
    connection — no ATTACH, so no lock issues).

    - transactions: INSERT OR IGNORE (dedupes on the unique index)
    - balance_history: skipped when a matching point already exists
    - profiles: added when the card_id is new to this install
    - settings: only missing keys are filled (never overwrite live prefs)

    Reconciliation adapts automatically because balance pairs are processed
    in chronological (fetched_at) order.
    """
    import tempfile
    if not data_b64:
        raise FetchError("no backup data", "badrequest")
    try:
        raw = base64.b64decode(data_b64)
    except Exception as e:  # noqa: BLE001
        raise FetchError("corrupt backup file", "badrequest") from e
    tmp = os.path.join(tempfile.gettempdir(),
                       "fynance_import_%s.db" % int(dt.datetime.now().timestamp() * 1000))
    try:
        with open(tmp, "wb") as f:
            f.write(raw)
        bconn = sqlite3.connect(tmp)
        bconn.row_factory = sqlite3.Row
        try:
            tx = bh = pr = st = 0
            for row in bconn.execute(
                    "SELECT fetched_at, card_id, date, shop, description, quantity,"
                    " unit_price, total FROM transactions"):
                cur = conn.execute(
                    "INSERT OR IGNORE INTO transactions (fetched_at, card_id, date, shop,"
                    " description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?,?)",
                    (row["fetched_at"], row["card_id"], row["date"], row["shop"],
                     row["description"], row["quantity"], row["unit_price"], row["total"]))
                tx += cur.rowcount
            for row in bconn.execute(
                    "SELECT fetched_at, card_id, balance_rm, balance_value, name,"
                    " student_no, department_class FROM balance_history"):
                dup = conn.execute(
                    "SELECT 1 FROM balance_history WHERE fetched_at = ? AND card_id = ?"
                    " AND balance_value IS ?",
                    (row["fetched_at"], row["card_id"], row["balance_value"])).fetchone()
                if dup:
                    continue
                cur = conn.execute(
                    "INSERT INTO balance_history (fetched_at, card_id, balance_rm,"
                    " balance_value, name, student_no, department_class)"
                    " VALUES (?,?,?,?,?,?,?)",
                    (row["fetched_at"], row["card_id"], row["balance_rm"],
                     row["balance_value"], row["name"], row["student_no"],
                     row["department_class"]))
                bh += cur.rowcount
            for row in bconn.execute(
                    "SELECT name, card_id, card_style, theme_family, monthly_budget,"
                    " low_balance_threshold, created_at, last_used FROM profiles"):
                if not row["card_id"]:
                    continue
                dup = conn.execute("SELECT 1 FROM profiles WHERE card_id = ?",
                                   (row["card_id"],)).fetchone()
                if dup:
                    continue
                cur = conn.execute(
                    "INSERT INTO profiles (name, card_id, card_style, theme_family,"
                    " monthly_budget, low_balance_threshold, created_at, last_used)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    (row["name"], row["card_id"], row["card_style"], row["theme_family"],
                     row["monthly_budget"], row["low_balance_threshold"],
                     row["created_at"], row["last_used"]))
                pr += cur.rowcount
            for row in bconn.execute("SELECT key, value FROM settings"):
                cur = conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                    (row["key"], row["value"]))
                st += cur.rowcount
            bconn.close()
            conn.commit()
        except Exception:
            try:
                bconn.close()
            except Exception:  # noqa: BLE001
                pass
            raise
    except FetchError:
        raise
    except Exception as e:  # noqa: BLE001
        raise FetchError(f"backup import failed: {e}", "db") from e
    finally:
        try:
            os.remove(tmp)
        except Exception:  # noqa: BLE001
            pass
    # re-apply active profile prefs (in case imported profiles changed things)
    ap = get_settings(conn).get("active_profile") or ""
    if ap and ap.isdigit():
        try:
            _apply_profile_prefs(conn, int(ap))
        except Exception:  # noqa: BLE001
            pass
    return {"transactions_added": tx, "balances_added": bh,
            "profiles_added": pr, "settings_filled": st,
            "profiles": profile_list(conn), "settings": get_settings(conn)}


# --------------------------------------------------------------------------
# Request dispatch
# --------------------------------------------------------------------------

def handle(action: str, payload: dict, conn, url: str):
    payload = payload or {}
    if action == "ping":
        return {"version": VERSION, "python": sys.version.split()[0],
                "db": conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
                if conn else 0}
    if action == "check":
        card_id = str(payload.get("card_id") or "").strip()
        if not card_id:
            raise FetchError("card_id is required", "badrequest")
        timeout = int(payload.get("timeout", 30))
        html = fetch_balance_page(card_id, url=url, timeout=timeout)
        snap = build_snapshot(card_id, html)
        persisted = append_snapshot(conn, snap)
        return {"snapshot": snap, "persisted": persisted}
    if action == "history":
        return {"rows": history_with_inferred(conn, str(payload.get("card_id") or ""),
                                              int(payload.get("limit", 500)))}
    if action == "balance_history":
        return {"rows": query_balance_history(conn, str(payload.get("card_id") or ""),
                                              int(payload.get("limit", 120)))}
    if action == "stats":
        return compute_stats(conn, str(payload.get("card_id") or ""))
    if action == "monthly":
        return monthly_summary(conn, str(payload.get("card_id") or ""))
    if action == "reconcile":
        return reconcile(conn, str(payload.get("card_id") or ""))
    if action == "settings_get":
        return {"settings": get_settings(conn)}
    if action == "settings_set":
        return {"settings": set_settings(conn, payload.get("values"))}
    if action == "reset_own":
        return reset_own(conn, payload.get("id"))
    if action == "backup_export":
        return backup_export(conn)
    if action == "backup_import":
        return backup_import(conn, payload.get("data_b64"))
    if action == "history_trim":
        """Keep only the newest N recorded transactions for a card."""
        card_id = str(payload.get("card_id") or "")
        keep = max(10, int(payload.get("keep", 500)))
        # delete all but the newest `keep` (by id)
        cur = conn.execute(
            "DELETE FROM transactions WHERE card_id = ? AND id NOT IN ("
            "  SELECT id FROM transactions WHERE card_id = ? ORDER BY id DESC LIMIT ?)",
            (card_id, card_id, keep))
        conn.commit()
        return {"deleted": cur.rowcount}
    if action == "profile_list":
        return {"profiles": profile_list(conn)}
    if action == "profile_add":
        return profile_add(conn, payload.get("name"), payload.get("card_id"),
                           payload.get("card_style"), payload.get("theme_family"),
                           payload.get("monthly_budget"), payload.get("low_balance_threshold"))
    if action == "profile_update":
        return profile_update(conn, payload.get("id"), payload.get("name"),
                              payload.get("card_id"), payload.get("card_style"),
                              payload.get("theme_family"), payload.get("monthly_budget"),
                              payload.get("low_balance_threshold"))
    if action == "profile_delete":
        return profile_delete(conn, payload.get("id"))
    if action == "profile_activate":
        return profile_activate(conn, payload.get("id"))
    if action == "reset":
        """Factory reset: wipe all data AND settings (full clean slate)."""
        tx = conn.execute("DELETE FROM transactions").rowcount
        bh = conn.execute("DELETE FROM balance_history").rowcount
        conn.execute("DELETE FROM settings")
        pr = conn.execute("DELETE FROM profiles").rowcount
        conn.commit()
        return {"transactions_deleted": tx, "balances_deleted": bh,
                "profiles_deleted": pr, "settings_reset": True}
    raise FetchError(f"unknown action: {action}", "badrequest")


def main():
    ap = argparse.ArgumentParser(description="eWallet data service (stdio JSON-RPC)")
    ap.add_argument("--db", default=os.path.join(os.path.expanduser("~"),
                                                 ".ewallet-dashboard", "ewallet.db"))
    ap.add_argument("--url", default=DEFAULT_URL)
    args = ap.parse_args()

    # ------------------------------------------------------------------
    # CRITICAL: force UTF-8 on stdout/stderr. On Windows the console
    # default (cp1252 "charmap") cannot encode Chinese student names and
    # would crash every sync with:
    #   'charmap' codec can't encode characters ... character maps to <undefined>
    # ------------------------------------------------------------------
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    conn = None
    try:
        conn = init_db(args.db)
    except Exception as e:
        _log(f"db init failed: {e}")

    _log(f"ewallet-cli {VERSION} ready | db={args.db} | url={args.url}")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            _respond({"id": None, "ok": False, "error": "invalid JSON",
                      "kind": "badrequest"})
            continue
        rid = req.get("id")
        try:
            data = handle(req.get("action"), req.get("payload"), conn, args.url)
            _respond({"id": rid, "ok": True, "data": data})
        except FetchError as e:
            _respond({"id": rid, "ok": False, "error": str(e), "kind": e.kind})
        except Exception as e:  # noqa: BLE001
            _log(traceback.format_exc())
            _respond({"id": rid, "ok": False, "error": f"internal: {e}",
                      "kind": "internal"})


def _respond(obj: dict, stream=None):
    """Write one JSON line. Falls back to raw UTF-8 bytes if the stream's
    text encoding chokes on non-ASCII (belt & braces on top of reconfigure)."""
    stream = stream or sys.stdout
    data = json.dumps(obj, ensure_ascii=False) + "\n"
    try:
        stream.write(data)
        stream.flush()
    except UnicodeEncodeError:
        buf = getattr(stream, "buffer", None)
        if buf is not None:
            buf.write(data.encode("utf-8", errors="replace"))
            buf.flush()
        else:
            # final fallback: pure-ASCII JSON escapes (always encodable)
            stream.write(json.dumps(obj, ensure_ascii=True) + "\n")
            stream.flush()


def _log(msg: str):
    sys.stderr.write(f"[ewallet-cli] {msg}\n")
    sys.stderr.flush()


if __name__ == "__main__":
    main()
