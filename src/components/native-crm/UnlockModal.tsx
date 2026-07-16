import React, { useState } from 'react';
import { useUnlockRecord } from '../../modules/native-crm/queries/record-lock.queries';

interface Props {
  entityModule: string;
  entityId:     string;
  onClose:      () => void;
  onUnlocked:   () => void;
}

export function UnlockModal({ entityModule, entityId, onClose, onUnlocked }: Props) {
  const [reason, setReason]   = useState('');
  const unlockMut             = useUnlockRecord(entityModule);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) return;
    await unlockMut.mutateAsync({ id: entityId, reason: reason.trim() });
    onUnlocked();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Unlock Record</h3>
        <p className="text-sm text-gray-500 mb-4">
          Provide a reason for unlocking. This action is recorded in the audit log.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-gray-400">(min 10 characters)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Correcting invoice line item per approval from finance team"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-xs text-red-500 mt-1">Minimum 10 characters required</p>
            )}
          </div>

          {unlockMut.isError && (
            <p className="text-sm text-red-600">{(unlockMut.error as any)?.response?.data?.message ?? 'Failed to unlock'}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 10 || unlockMut.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {unlockMut.isPending ? 'Unlocking…' : 'Unlock Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
