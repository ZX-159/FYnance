// components/DangerConfirm.jsx — FULL-SCREEN destructive confirmation.
// Rendered via a PORTAL into document.body, so it always covers the whole
// app window regardless of which view is scrolled where. Solid red button.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';

export default function DangerConfirm({
  open, title, body, confirmLabel, cancelLabel = null,
  busy = false, onConfirm, onCancel, icon = 'trash',
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

  const IconSvg = icon === 'reset' ? (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );

  return createPortal(
    <div
      className="danger-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="danger-modal">
        <div className="danger-modal-icon">{IconSvg}</div>
        <div className="danger-modal-title">{title}</div>
        <p className="danger-modal-body">{body}</p>
        <div className="danger-modal-actions">
          <button className="secondary-button" onClick={onCancel} disabled={busy}>
            {cancelLabel || t('cancel')}
          </button>
          <button className="danger-confirm-btn" onClick={onConfirm} disabled={busy}>
            {busy ? t('resetting') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
