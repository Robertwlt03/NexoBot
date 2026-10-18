import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './ui';

export interface ConfirmRequest {
  title: string;
  text: ReactNode;
  confirmLabel: string;
  /** Red button (default) for destructive actions. */
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

/** Confirmation modal for destructive actions: `confirm({...})` opens it, render `dialog` once in the page. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!request) return;
    setBusy(true);
    try {
      await request.onConfirm();
    } finally {
      setBusy(false);
      setRequest(null);
    }
  };

  const dialog = request && (
    <Modal
      title={request.title}
      onClose={() => { if (!busy) setRequest(null); }}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setRequest(null)} disabled={busy}>Abbrechen</button>
          <button type="button" className={`btn ${request.danger === false ? 'btn-primary' : 'btn-danger'}`} onClick={run} disabled={busy}>
            {busy ? 'Einen Moment …' : request.confirmLabel}
          </button>
        </>
      )}
    >
      <p className="muted">{request.text}</p>
    </Modal>
  );

  return { confirm: setRequest, dialog };
}
