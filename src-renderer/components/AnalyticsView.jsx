import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { toast } from '../lib/toast';

function monthLabel(locale, m) {
  const [y, mo] = (m || '').split('-');
  if (!y || !mo) return m || '—';
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(Number(y), Number(mo) - 1, 1));
  } catch {
    return m;
  }
}

const SHOP_COLORS = ['#34775c', '#7c83db', '#e4a06d', '#a9c8bc', '#6d92d0', '#c9a86a', '#8a83da'];

export default function AnalyticsView({ data }) {
  const { t, fmtRM, fmtDate, locale } = useI18n();
  const { monthly } = data;
  const months = monthly.months || [];
  const totals = monthly.totals || {};
  const s = data.stats || {};

  const [hoverBar, setHoverBar] = useState(null);

  const bars = useMemo(
    () => [...months].reverse().map((m) => ({
      label: monthLabel(locale, m.month),
      known: m.known_total || 0,
      unknown: m.unknown_total || 0,
    })),
    [months, locale],
  );
  const maxV = Math.max(1, ...bars.map((b) => b.known + b.unknown)) * 1.1;

  const shopRows = useMemo(() => {
    const acc = {};
    for (const tx of data.history) {
      if (tx.inferred) continue;
      const shop = (tx.shop || t('unknown')).trim() || t('unknown');
      acc[shop] = (acc[shop] || 0) + (Number(tx.total) || 0);
    }
    const total = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(acc)
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100, pct: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [data.history, t]);
  const donutTotal = shopRows.reduce((a, r) => a + r.value, 0);

  // build conic gradient
  let accPct = 0;
  const stops = shopRows.map((r, i) => {
    const from = accPct;
    accPct += r.pct;
    return `${SHOP_COLORS[i % SHOP_COLORS.length]} ${from}% ${accPct}%`;
  });
  const conic = stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e5e9e5 0 100%)';

  const avgMonth = months.length ? (totals.total_spent / months.length).toFixed(2) : '—';
  const topShop = shopRows[0];

  const doExport = async (kind, nameKey) => {
    const res = await window.api.exportCsv(kind);
    if (res.saved) toast(t('exported_to', { name: t(nameKey), path: res.filePath }), 'ok', 6000);
    else if (!res.canceled) toast(res.error || t('export_failed'), 'error');
  };

  return (
    <div className="page-wrap">
      <section className="welcome-row compact-welcome analytics-welcome">
        <div>
          <h2>{t('nav_analytics')}</h2>
          <p>{t('summary_report')} · {t('local_ledger', { time: t('synced') })}</p>
        </div>
        <button className="primary-button" onClick={() => doExport('monthly', 'export_summary')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
          {t('download_report')}
        </button>
      </section>

      <section className="analytics-metrics">
        <div><span>{t('monthly_avg')}</span><strong>{fmtRM(avgMonth)}</strong><small className="good">{t('total_spend')}</small></div>
        <div><span>{t('largest_category')}</span><strong>{topShop ? topShop.label : '—'}</strong><small>{topShop ? `${topShop.pct}%` : ''}</small></div>
        <div><span>{t('topup_freq')}</span><strong>{fmtRM(s.topup_total)}</strong><small>{t('topups')}</small></div>
        <div><span>{t('uncategorised')}</span><strong>{fmtRM(s.unknown_total)}</strong><small className="warn">{t('needs_look')}</small></div>
      </section>

      <section className="analytics-grid">
        <article className="panel analytics-bars">
          <div className="panel-heading">
            <div><span className="kicker">{t('cash_movement')}</span><h3>{t('spending_by_month')}</h3></div>
          </div>
          <div className="bar-chart-area">
            <div className="y-axis"><span>RM {Math.round(maxV)}</span><span>{Math.round(maxV * 0.66)}</span><span>{Math.round(maxV * 0.33)}</span><span>0</span></div>
            <div className="bar-grid"><i /><i /><i /><i /></div>
            <div className="bar-columns">
              {bars.map((b, i) => (
                <div className="bar-column" key={b.label} onMouseEnter={() => setHoverBar(i)} onMouseLeave={() => setHoverBar(null)}>
                  {hoverBar === i && (
                    <div className="bar-tooltip">
                      <small>{b.label} {t('total')}</small>
                      <strong>RM {(b.known + b.unknown).toFixed(2)}</strong>
                      {b.unknown > 0 && <span>RM {b.unknown.toFixed(2)} {t('inferred')}</span>}
                    </div>
                  )}
                  <div className="stacked-bar">
                    <i className="known-bar" style={{ height: `${(b.known / maxV) * 100}%` }} />
                    {b.unknown > 0 && <i className="unknown-bar" style={{ height: `${(b.unknown / maxV) * 100}%` }} />}
                  </div>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend analytics-legend">
            <span><i className="legend-dot sage" />{t('known')}</span>
            <span><i className="legend-dot amber" />{t('inferred')}</span>
            <em>{fmtRM(totals.total_spent)} {t('total_tracked')}</em>
          </div>
        </article>

        <article className="panel donut-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('merchant_mix')}</span><h3>{t('where_lands')}</h3></div>
          </div>
          <div className="donut-layout">
            <div className="donut" style={{ background: conic }}>
              <div><strong>RM {Math.round(donutTotal)}</strong><span>{t('total_spend')}</span></div>
            </div>
            <div className="donut-legend">
              {shopRows.map((r, i) => (
                <div key={r.label}>
                  <i style={{ background: SHOP_COLORS[i % SHOP_COLORS.length] }} />
                  <span>{r.label}</span>
                  <strong>{r.pct}%</strong>
                </div>
              ))}
              {shopRows.length === 0 && <span>{t('no_tx_yet')}</span>}
            </div>
          </div>
          <div className="insight-box">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
            <div>
              <strong>{t('useful_signal')}</strong>
              <p>{s.unknown_total > 0
                ? t('signal_unknown_spend') + ' · ' + t('signal_unknown_sub', { n: s.unknown_total.toFixed(2) })
                : t('signal_no_unknown') + ' · ' + t('signal_no_unknown_sub')}</p>
            </div>
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-heading">
            <div><span className="kicker">{t('monthly_close')}</span><h3>{t('summary_report')}</h3></div>
            <button className="text-button" onClick={() => doExport('transactions', 'nav_history')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
              {t('export_tx_csv')}
            </button>
          </div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>{t('month')}</th><th>{t('known_col_s')}</th><th>{t('inferred_col')}</th>
                  <th>{t('total_out')}</th><th>{t('topups_col')}</th><th>{t('closing_balance')}</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td><strong>{monthLabel(locale, m.month)} {m.month.slice(0, 4)}</strong></td>
                    <td>{fmtRM(m.known_total)}</td>
                    <td className="inferred-cell">{m.unknown_total > 0 ? fmtRM(m.unknown_total) : '—'}</td>
                    <td>{fmtRM(m.total_spent)}</td>
                    <td>{m.topup_total > 0 ? fmtRM(m.topup_total) : '—'}</td>
                    <td><strong>{m.end_balance !== null ? fmtRM(m.end_balance) : '—'}</strong></td>
                  </tr>
                ))}
                {months.length === 0 && (
                  <tr><td colSpan="6" className="tx-empty">{t('no_data_yet')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
