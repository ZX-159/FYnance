// components/FlipCard.jsx — 3D flip hero card, two styles:
//   'flip-dark' — dark credit-card (Praashoo7-inspired)
//   'flip-gold' — gold gradient (VassoD-inspired)
// Shows the REAL card holder name and the REAL 10-digit card ID
// (no mastercard/visa logos — branded FYnance instead).

import { useState } from 'react';
import { useI18n } from '../lib/i18n';

/* ------------------------------ tiny icons ------------------------------- */

function Chip({ dark }) {
  return (
    <svg className="flip-chip" viewBox="0 0 24 24" width="30" height="30">
      <rect x="1.5" y="4" width="21" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v16M12 4v16M17 4v16M1.5 9h5M1.5 15h5M17.5 9h5M17.5 15h5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 8.5c4.5 0 4.5-3 9-3s4.5 3 9 3" />
      <path d="M2.5 13c4.5 0 4.5-3 9-3s4.5 3 9 3" />
      <path d="M2.5 17.5c4.5 0 4.5-3 9-3s4.5 3 9 3" />
    </svg>
  );
}

/* ------------------------------- helpers --------------------------------- */

/** Group the (real) card number for display: 0002 3290 52 */
function groupNumber(id) {
  const d = String(id || '').replace(/\D/g, '');
  if (!d) return '••••  ••••';
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "SINCE 08/26" from the first recorded balance (real data) */
function sinceLabel(firstRecorded) {
  if (!firstRecorded) return null;
  const d = new Date(firstRecorded);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

/* -------------------------------- component ------------------------------ */

export default function FlipCard({ style = 'flip-dark', name, cardId, studentNo, departmentClass, firstRecorded }) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);

  const dispName = (name || '').trim() || t('not_synced');
  const dispNumber = groupNumber(cardId);
  const since = sinceLabel(firstRecorded);

  return (
    <div className={`flip-card ${style} ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
      <div className="flip-card-inner">

        {/* ══════════ FRONT ══════════ */}
        <div className="flip-card-front">
          <div className="flip-body">
            <div className="flip-row">
              <span className="flip-brand">FYnance</span>
              <Contactless />
            </div>
            <div className="flip-row" style={{ alignItems: 'center' }}>
              <Chip />
            </div>
            <div>
              <span className="flip-label">{t('card_number')}</span>
              <div className="flip-number">{dispNumber}</div>
            </div>
            <div className="flip-lower">
              <div>
                <span className="flip-label">{t('card_holder')}</span>
                <div className="flip-name">{dispName}</div>
              </div>
              {since && (
                <div>
                  <span className="flip-label">{t('valid_since')}</span>
                  <div className="flip-since">{since}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ BACK ══════════ */}
        <div className="flip-card-back">
          <div className="strip" />
          {style === 'flip-dark' && (
            <>
              <div className="mstrip" />
              <div className="sstrip"><span className="code">FY</span></div>
            </>
          )}
          <div className="flip-info">
            <div className="fi-row">
              <span className="fi-label">{t('student_no')}</span>
              <span className="fi-value">{studentNo || '—'}</span>
            </div>
            <div className="fi-row">
              <span className="fi-label">{t('class')}</span>
              <span className="fi-value">{departmentClass || '—'}</span>
            </div>
            <div className="fi-row">
              <span className="fi-label">{t('card_number')}</span>
              <span className="fi-value">{dispNumber}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
