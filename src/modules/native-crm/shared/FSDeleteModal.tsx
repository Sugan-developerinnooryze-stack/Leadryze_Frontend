import { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface FSDeleteModalProps {
  label:     string;
  onClose:   () => void;
  onConfirm: () => Promise<any>;
}

export default function FSDeleteModal({ label, onClose, onConfirm }: FSDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-full bg-danger-500/10 flex items-center justify-center mb-4">
            <TrashIcon className="h-6 w-6 text-danger-600 dark:text-danger-500" />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">Delete "{label}"?</h3>
          <p className="text-sm text-text-muted">This action cannot be undone.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-danger-600 text-white text-sm font-medium hover:bg-danger-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
