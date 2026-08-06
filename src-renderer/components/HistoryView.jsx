import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { toast } from '../lib/toast';

const FILTERS = ['all', 'out', 'unknown'];

export default function HistoryView({ data, initialQuery }) {
  const { t, fmtRM } = useI18n();
  const [search, setSearch] = useState(initialQuery || '');
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.history.filter((tx) => {
      const matchQ = !q || `${tx.date} ${tx.shop} ${tx.description}`.toLowerCase().includes(q);
      const matchF =
        filter === 'all' ? true
        : filter === 'out' ? !tx.inferred
        : tx.inferred;
      return matchQ && matchF;
    });
  }, [data.history, search, filter]);

  const exportCsv = async () => {
    const res = await window.api.exportCsv('transactions');
    if (res.saved) toast(t('exported_to', { name: t('nav_history'), path: res.filePath }), 'ok', 6000);
    else if (!res.canceled) toast(res.error || t('export_failed'), 'error');
  };

  const labelFor = (f) =>
    f === 'all' ? t('all_entries') : f === 'out' ? t('money_out') : t('uncategorised');

  return (
    <div className="page-wrap">
      <section className="welcome-row compact-welcome">
        <div>
          <h2>{t('nav_history')}</h2>
          <p>{t('local_ledger', { time: t('synced') })}</p>
        </div>
        <button className="primary-button" onClick={exportCsv}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
          {t('export_csv')}
        </button>
      </section>

      <section className="activity-toolbar panel">
        <label className="table-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_placeholder')} />
          {search && (
            <button onClick={() => setSearch('')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </label>
        <div className="filter-pills">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{labelFor(f)}</button>
          ))}
        </div>
        <button className="filter-button">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          {t('filters')}
        </button>
      </section>

      <section className="ledger panel">
        <div className="ledger-head">
          <div><span>{t('showing_entries', { n: rows.length })}</span><strong>{t('net_movement')} · {fmtRM(-(data.stats.total_spent_incl_unknown ?? data.stats.total_spent ?? 0))}</strong></div>
        </div>
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>{t('merchant')}</th><th>{t('category')}</th><th>{t('date_time')}</th>
                <th className="align-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx, i) => (
                <tr key={`${tx.date}-${i}`} className={tx.inferred ? 'unknown-row' : ''}>
                  <td>
                    <div className="merchant-cell">
                      <span className="transaction-icon">{tx.inferred ? '?' : (tx.shop || '•').trim().charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{tx.inferred ? t('unknown_inferred') : (tx.shop || '—')}</strong>
                        <small>{tx.inferred ? tx.description : (tx.description || '—')}{tx.quantity ? ` · ${tx.quantity} × ${tx.unit_price || ''}` : ''}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className={`category-pill ${tx.inferred ? 'warning' : ''}`}>{tx.inferred ? t('unknown') : t('category')}</span></td>
                  <td><span className="table-date">{tx.date || '—'}</span></td>
                  <td className={`align-right table-amount ${tx.inferred ? '' : ''}`}>{fmtRM(tx.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <strong>{t('no_matching')}</strong>
              <span>{t('no_matching_sub')}</span>
            </div>
          )}
        </div>
        <div className="ledger-foot">
          <span>{t('local_ledger', { time: t('synced') })}</span>
          <div><button disabled>{t('previous')}</button><button className="active">1</button><button disabled>{t('next')}</button></div>
        </div>
      </section>
    </div>
  );
}
