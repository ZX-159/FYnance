import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';

/**
 * ConfirmModal — styled in-app confirmation dialog (used for destructive
 * actions like the database reset).
 */
export default function ConfirmModal({
  open, title, body, confirmLabel, cancelLabel, tone = 'danger',
  busy = false, onConfirm, onCancel,
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
      if (e.key === 'Enter' && !busy) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-icon danger">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" /><path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>{cancelLabel || t('cancel')}</button>
          <button className={`btn-danger ${busy ? 'spinning' : ''}`} onClick={onConfirm} disabled={busy}>
            {busy ? t('resetting') : (confirmLabel || t('reset'))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
