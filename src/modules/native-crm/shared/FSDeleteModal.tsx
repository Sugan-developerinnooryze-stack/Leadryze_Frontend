import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface FSDeleteModalProps {
  label:     string;
  onClose:   () => void;
  onConfirm: () => Promise<any>;
  // All optional, defaulting to today's exact delete wording/styling — lets
  // this same in-app modal (instead of the browser's native confirm()) back
  // softer, reversible actions too, like deactivating a Company, without
  // implying "cannot be undone" for something that actually can be.
  title?:           string;
  description?:     string;
  confirmLabel?:    string;
  confirmingLabel?: string;
  icon?:            ComponentType<SVGProps<SVGSVGElement>>;
  tone?:            'danger' | 'warning';
}

export default function FSDeleteModal({
  label, onClose, onConfirm,
  title, description, confirmLabel, confirmingLabel, icon: Icon = TrashIcon, tone = 'danger',
}: FSDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      // A blocked delete (e.g. linked records still exist) must be visible,
      // not swallowed — leave the modal open so the error is seen in context
      // rather than closing as if the delete had actually gone through.
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const iconWrapCls  = tone === 'warning' ? 'bg-amber-500/10' : 'bg-danger-500/10';
  const iconCls      = tone === 'warning' ? 'text-amber-600 dark:text-amber-500' : 'text-danger-600 dark:text-danger-500';
  const confirmBtnCls = tone === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700'
    : 'bg-danger-600 hover:bg-danger-700';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${iconWrapCls}`}>
            <Icon className={`h-6 w-6 ${iconCls}`} />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">{title ?? `Delete "${label}"?`}</h3>
          <p className="text-sm text-text-muted">{description ?? 'This action cannot be undone.'}</p>
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
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${confirmBtnCls}`}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? (confirmingLabel ?? 'Deleting…') : (confirmLabel ?? 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
