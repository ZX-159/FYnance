// components/OnboardingWizard.jsx — first-run guided setup.
// Shown when there are zero accounts: Welcome → Create account → Done.
// Guides the user through creating their first account so they never have
// to hunt for Settings.

import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { DEMO_CARD } from '../lib/demo';

export default function OnboardingWizard({ onComplete, onSkip }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!cardId.trim()) {
      setError(t('wizard_need_card'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onComplete(name, cardId);
    } catch (e) {
      setError(e.message || t('save_failed', { msg: '' }));
      setBusy(false);
    }
  };

  const steps = [
    {
      title: t('wizard_welcome_title'),
      body: t('wizard_welcome_body'),
      points: [t('wizard_p1'), t('wizard_p2'), t('wizard_p3')],
    },
    {
      title: t('wizard_create_title'),
      body: t('wizard_create_body'),
      form: true,
    },
    {
      title: t('wizard_done_title'),
      body: t('wizard_done_body'),
      done: true,
    },
  ];
  const cur = steps[step];

  const next = () => {
    setError('');
    if (step === 0) setStep(1);
    else if (step === 1) create();          // create → success state
    else onCompleteAndGo();
  };

  const onCompleteAndGo = () => {
    // after creation the wizard's job is done; parent refreshes + lands on Overview
    onSkip && onSkip();
  };

  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="wizard-brand">
          <div className="brand-mark"><span className="brand-fy">FY</span></div>
          <span className="wizard-brand-name">{t('app_name')}</span>
        </div>

        <div className="wizard-progress">
          {steps.map((_, i) => (
            <span key={i} className={`wizard-dot ${i <= step ? 'on' : ''}`} />
          ))}
        </div>

        <div className="wizard-body">
          <h2>{cur.title}</h2>
          <p>{cur.body}</p>

          {step === 0 && (
            <ul className="wizard-points">
              {cur.points.map((p, i) => (
                <li key={i}>
                  <span className="wizard-check">✓</span> {p}
                </li>
              ))}
            </ul>
          )}

          {step === 1 && (
            <div className="wizard-form">
              <div className="field">
                <label htmlFor="wizName">{t('account_name')}</label>
                <input
                  id="wizName"
                  className="acct-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('wizard_name_ph')}
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="wizCard">{t('card_id')}</label>
                <input
                  id="wizCard"
                  className="acct-input"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  placeholder={DEMO_CARD}
                  maxLength={20}
                  spellCheck={false}
                />
                <p className="field-hint">{t('card_id_hint')}</p>
              </div>
              {error && <p className="wizard-error">{error}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-success">
              <div className="wizard-check-big">✓</div>
            </div>
          )}
        </div>

        <div className="wizard-actions">
          {step < 2 && (
            <button className="btn-ghost" onClick={onSkip} disabled={busy}>{t('wizard_skip')}</button>
          )}
          <button className="btn-primary" onClick={next} disabled={busy}>
            {busy ? t('syncing') : step === 2 ? t('wizard_get_started') : t('wizard_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
