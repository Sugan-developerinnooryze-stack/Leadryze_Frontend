import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ConfirmDangerousActionProps {
  open: boolean;
  title: string;
  consequences: string[];
  /** The word/phrase the operator must type verbatim — usually the tenant or user's name. */
  confirmWord: string;
  confirmLabel?: string;
  requireReason?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

/** Shared type-to-confirm + optional reason-capture modal for every
 * destructive Super Admin action (tenant deactivate, password reset,
 * force-verify). Never fires on a single click — see the plan's
 * "Confirmation for dangerous actions" section. */
export function ConfirmDangerousAction({
  open, title, consequences, confirmWord, confirmLabel = 'Confirm', requireReason = false, loading = false, onCancel, onConfirm,
}: ConfirmDangerousActionProps) {
  const [typed, setTyped]   = useState('');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const canConfirm = typed.trim() === confirmWord && (!requireReason || reason.trim().length > 0);

  const submit = () => {
    if (!canConfirm || loading) return;
    onConfirm(requireReason ? reason.trim() : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-danger-title"
        className="bg-surface-elevated border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <div className="h-10 w-10 rounded-full bg-danger-500/10 text-danger-600 flex items-center justify-center shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-1.5">
            <h3 id="confirm-danger-title" className="text-base font-semibold text-text-primary">{title}</h3>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="text-text-muted hover:text-text-primary shrink-0">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-3">
          <p className="text-sm text-text-muted mb-1.5">This will:</p>
          <ul className="text-sm text-text-muted space-y-1 list-disc list-inside">
            {consequences.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>

        {requireReason && (
          <div className="px-6 pt-4">
            <label htmlFor="confirm-danger-reason" className="block text-xs font-medium text-text-muted mb-1">Reason</label>
            <textarea
              id="confirm-danger-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this action being taken?"
              className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger-500/40 focus:border-transparent"
            />
          </div>
        )}

        <div className="px-6 pt-4">
          <label htmlFor="confirm-danger-typed" className="block text-xs font-medium text-text-muted mb-1">
            Type <span className="font-mono font-semibold text-text-primary">{confirmWord}</span> to confirm
          </label>
          <input
            id="confirm-danger-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            autoFocus
            className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger-500/40 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 px-6 py-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm bg-surface hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-border text-text-primary rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canConfirm || loading}
            className="flex-1 px-4 py-2 text-sm bg-danger-600 hover:bg-danger-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
