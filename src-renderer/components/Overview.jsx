import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useClock, greetingKey, clockDate } from '../hooks/useClock';
import FlipCard from './FlipCard';
import { DEMO_CARD } from '../lib/demo';

function last4Weeks(history) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - w * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    let sum = 0;
    for (const tx of history) {
      const d = new Date(String(tx.date || '').slice(0, 10) + 'T00:00:00');
      if (!Number.isNaN(d.getTime()) && d >= start && d < end) sum += Number(tx.total) || 0;
    }
    weeks.push({ label: `W${4 - w}`, value: Math.round(sum * 100) / 100 });
  }
  return weeks;
}

const ICONS = {
  wallet: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="3" /><path d="M2.5 10h19" /><circle cx="16.5" cy="15" r="1.4" fill="currentColor" stroke="none" /></svg>
  ),
  spend: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /><path d="M12 8v5l3 2" /></svg>
  ),
  topup: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="M17 8l-5-5-5 5" /></svg>
  ),
  tx: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10M7 12h10M7 17h6" /></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
  ),
};

function Metric({ label, value, sub, accent, icon }) {
  return (
    <div className="metric">
      <span className={`metric-icon ${accent}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}

/* SVG balance-rhythm chart with hover */
function CashflowChart({ rows }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(null);
  const vals = rows.map((r) => Number(r.balance_value)).filter((v) => !Number.isNaN(v));

  // not enough points yet → friendly empty state (prevents divide-by-zero
  // and undefined-index crashes)
  if (vals.length < 2) {
    return (
      <div className="cashflow-chart">
        <div className="chart-empty chart-empty-abs">{t('chart_not_enough')}</div>
      </div>
    );
  }

  const W = 600, H = 150;
  const max = Math.max(...vals) * 1.08;
  const min = Math.min(...vals) * 0.95;
  const span = max - min || 1;
  const pts = vals.map((v, i) => ({
    x: 26 + (i * (W - 52)) / (vals.length - 1),
    y: 150 - ((v - min) / span) * 120,
    v,
  }));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `${path} L ${last.x} 158 L ${pts[0].x} 158 Z`;

  return (
    <div className="cashflow-chart">
      {hover !== null && pts[hover] && (
        <div className="chart-tooltip" style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${Math.max(0, pts[hover].y - 26)}px` }}>
          <span>{rows[hover] ? String(rows[hover].fetched_at || '').slice(0, 10) : ''}</span>
          <strong>RM {pts[hover].v.toFixed(2)}</strong>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H + 34}`} role="img" aria-label="balance trend">
        <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 70, 110, 150].map((y) => <line key={y} x1="20" x2="580" y1={y} y2={y} className="grid-line" />)}
        <path d={area} fill="url(#chartArea)" />
        <path key={vals.join(',')} d={path} fill="none" className="spend-line"
          style={{ strokeDasharray: 2000, strokeDashoffset: hover === null ? 0 : 0, animation: 'drawline 1.1s var(--ease) both' }} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'crosshair' }}>
            <rect x={p.x - 18} y="12" width="36" height="154" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.2} className="chart-point" />
            <text x={p.x} y="179" textAnchor="middle" className="axis-label">
              {String(rows[i] ? rows[i].fetched_at || '' : '').slice(5, 10)}
            </text>
          </g>
        ))}
      </svg>
      <style>{`@keyframes drawline { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function Overview({ appState, data, cardConfigured, themeKey, cardStyle, onGotoHistory, onGotoSettings, onGotoAnalytics }) {
  const { t, fmtRM, timeAgo } = useI18n();
  const r = appState.lastResult;
  const s = data.stats || {};
  const history = data.history || [];
  const bh = data.balanceHistory || [];
  const monthly = (data.monthly && data.monthly.months) || [];

  const balanceDisplay = useAnimatedNumber(r ? r.balance_value : null, (v) => (v === null ? '—' : fmtRM(v)));
  const spentDisplay = useAnimatedNumber(s.total_spent ?? 0, (v) => fmtRM(v));

  const firstName = r ? (r.name || '').trim().split(/\s+/)[0] : null;

  // live clock → time-aware greeting (updates across noon/6pm boundaries)
  const now = useClock();
  const greetKey = greetingKey(now);

  // month stats for pace (budget-aware: if a monthly budget is set, pace
  // is measured against it and overspend is shown in red)
  const nowMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = monthly.find((m) => m.month === nowMonth);
  const spentMonth = (thisMonth && thisMonth.total_spent) || 0;
  const available = curBal();
  const totalBudget = available + spentMonth;
  const budgetRaw = appState.settings.monthly_budget || '';
  const budget = Number(budgetRaw) > 0 ? Number(budgetRaw) : null;
  const budgetOverspent = budget !== null ? spentMonth - budget : 0; // + = over
  const pacePct = budget
    ? Math.min(1.2, spentMonth / budget)
    : (totalBudget > 0 ? Math.min(1, spentMonth / totalBudget) : 0);

  function curBal() {
    return r ? Number(r.balance_value) || 0 : 0;
  }

  // categories (top 4)
  const categories = useMemo(() => {
    const acc = {};
    let total = 0;
    for (const tx of history) {
      if (tx.inferred) continue;
      const shop = (tx.shop || t('unknown')).trim() || t('unknown');
      const v = Number(tx.total) || 0;
      acc[shop] = (acc[shop] || 0) + v;
      total += v;
    }
    return Object.entries(acc)
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((row) => ({ ...row, pct: total > 0 ? Math.round((row.value / total) * 100) : 0 }));
  }, [history, t]);

  // ── onboarding fallback (post-skip) ──
  if (!cardConfigured) {
    return (
      <div className="page-wrap">
        <div className="onboarding">
          <div className="onboarding-hero">
            <div className="onboarding-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 10h19" />
                <circle cx="6" cy="15" r="1" fill="currentColor" stroke="none" />
                <circle cx="9.5" cy="15" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h2>{t('wizard_create_title')}</h2>
            <p>{t('connect_body', { demo: DEMO_CARD })}</p>
            <p className="demo-note">{t('demo_card_note')} · <code>{DEMO_CARD}</code></p>
            <button className="primary-button" onClick={onGotoSettings}>{t('create_account_btn')}</button>
          </div>
        </div>
      </div>
    );
  }

  const recent = history.slice(0, 6);
  const dateLine = clockDate(now);

  return (
    <div className="page-wrap">
      {/* welcome */}
      <section className="welcome-row">
        <div>
          <p className="date-line">{ICONS.calendar} {dateLine}</p>
          <h2>{t(greetKey, { name: firstName || t('not_synced') })}</h2>
          <p>
            <strong>{t('insight_line', { spent: fmtRM(spentMonth), avail: fmtRM(available) })}</strong>
          </p>
        </div>
        <div className="welcome-actions">
          <button className="secondary-button" onClick={onGotoAnalytics}>{ICONS.chart} {t('view_report')}</button>
        </div>
      </section>

      {/* metric strip */}
      <section className="metric-strip">
        <Metric label={t('available_month')} value={fmtRM(available)} sub={t('last_update')} accent="lime" icon={ICONS.wallet} />
        <Metric label={t('spent_month')} value={spentDisplay} sub={`${t('tx_recorded')}: ${s.transaction_count ?? 0}`} accent="blue" icon={ICONS.spend} />
        <Metric label={t('topups')} value={fmtRM(s.topup_total)} sub={t('unknown_inferred')} accent="peach" icon={ICONS.topup} />
        <Metric label={t('tx_recorded')} value={String(s.transaction_count ?? 0)} sub={s.unknown_count ? `${s.unknown_count} ${t('unknown')}` : t('all_entries')} accent="violet" icon={ICONS.tx} />
      </section>

      {/* overview grid */}
      <section className="overview-grid">
        {/* wallet */}
        <article className="panel wallet-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('primary_account')}</span><h3>{t('campus_wallet')}</h3></div>
          </div>
          <div className="flip-scene">
            <FlipCard
              style={cardStyle}
              name={r ? r.name : null}
              cardId={r ? r.card_id : (appState.settings.card_id || '')}
              studentNo={r ? r.student_no : null}
              departmentClass={r ? r.department_class : null}
              firstRecorded={s.first_recorded || (r ? r.fetched_at : null)}
            />
          </div>
          <div className="wallet-foot">
            <span><i className="secure-dot" />{t('protected_local')}</span>
            <span>{t('updated_ago', { time: timeAgo(appState.lastSync) })}</span>
          </div>
        </article>

        {/* cashflow */}
        <article className="panel cashflow-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('cash_movement')}</span><h3>{t('spending_rhythm')}</h3></div>
          </div>
          <div className="chart-summary">
            <strong>{fmtRM(available)}</strong>
            <span>{t('balance_label')}</span>
          </div>
          <CashflowChart rows={bh} />
          <div className="chart-legend">
            <span><i className="legend-dot sage" />{t('known_spend')}</span>
            <span><i className="legend-dot amber" />{t('inferred')}</span>
            <em>{t('hover_chart')}</em>
          </div>
        </article>

        {/* pace */}
        <article className="panel pace-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('monthly_guardrail')}</span><h3>{t('month_pace', { month: new Date().toLocaleDateString(undefined, { month: 'long' }) })}</h3></div>
          </div>
          <div className="pace-content">
            <div
              className={`pace-ring ${budgetOverspent > 0 ? 'over' : ''}`}
              style={{ '--progress': `${Math.min(100, Math.round(pacePct * 100))}%` }}
            >
              <div>
                <strong>{Math.round(pacePct * 100)}%</strong>
                <span>{budget ? t('of_budget') : t('of_limit')}</span>
              </div>
            </div>
            <div className="pace-copy">
              <small>{budget ? t('budget_remaining') : t('remaining')}</small>
              <strong className={budgetOverspent > 0 ? 'pace-over' : ''}>
                {budgetOverspent > 0 ? `-${fmtRM(budgetOverspent)}` : fmtRM(Math.max(0, budget ? budget - spentMonth : available))}
              </strong>
              <span>{t('spent_of', { spent: fmtRM(spentMonth), limit: fmtRM(budget || totalBudget) })}</span>
            </div>
          </div>
          <div className="pace-track">
            <span style={{ width: `${Math.min(100, Math.round(pacePct * 100))}%` }} />
            <i style={{ left: `${Math.min(100, Math.round(pacePct * 100))}%` }} />
          </div>
          <div className="pace-labels"><span>RM 0</span><span>{fmtRM(budget || totalBudget)}</span></div>
          <div className={`pace-callout ${budgetOverspent > 0 ? 'over' : ''}`}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
            <p>
              {budgetOverspent > 0 ? (
                <strong className="pace-over-text">{t('overspent', { n: fmtRM(budgetOverspent) })}</strong>
              ) : budget ? (
                <strong>{t('under_budget', { n: fmtRM(Math.max(0, budget - spentMonth)) })}</strong>
              ) : (
                <strong>{t('on_track')}</strong>
              )}
              {' · '}{t('pace_callout', { n: fmtRM(Math.max(0, budget ? budget - spentMonth : available)) })}
            </p>
          </div>
        </article>

        {/* categories */}
        <article className="panel category-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('where_it_went')}</span><h3>{t('top_categories')}</h3></div>
            <button className="text-button" onClick={onGotoAnalytics}>{t('explore')} →</button>
          </div>
          {categories.length === 0 && <div className="tx-empty">{t('no_tx_yet')}</div>}
          {categories.map((c) => (
            <div className="category-row" key={c.label}>
              <span className="category-icon">{ICONS.spend}</span>
              <div className="category-main">
                <div><strong>{c.label}</strong><span>{fmtRM(c.value)}</span></div>
                <div className="mini-progress"><i style={{ width: `${c.pct}%` }} /></div>
              </div>
              <small>{c.pct}%</small>
            </div>
          ))}
          {categories.length > 0 && (
            <div className="category-total"><span>{t('known_spend')}</span><strong>{fmtRM(s.total_spent)}</strong></div>
          )}
        </article>

        {/* activity */}
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('latest_entries')}</span><h3>{t('recent_transactions')}</h3></div>
            <button className="text-button" onClick={onGotoHistory}>{t('view_insights')} →</button>
          </div>
          <div className="transaction-list">
            {recent.length === 0 && <div className="tx-empty">{t('no_tx_yet')}</div>}
            {recent.map((tx, i) => (
              <div className={`transaction-row ${tx.inferred ? 'unknown' : ''}`} key={`${tx.date}-${i}`}>
                <span className="transaction-icon">{tx.inferred ? '?' : (tx.shop || '•').trim().charAt(0).toUpperCase()}</span>
                <div className="transaction-copy">
                  <strong>{tx.inferred ? t('unknown_inferred') : (tx.shop || '—')}</strong>
                  <small>{tx.inferred ? tx.description : `${tx.description || '—'}${tx.quantity ? ` · ${tx.quantity}×${tx.unit_price || ''}` : ''}`}</small>
                </div>
                <div className="transaction-date">{tx.date || '—'}</div>
                <div className="transaction-amount">{fmtRM(tx.total)}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
