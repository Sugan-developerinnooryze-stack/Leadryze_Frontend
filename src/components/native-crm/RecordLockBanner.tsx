import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { UnlockModal } from './UnlockModal';

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];

interface Props {
  record:       any;
  entityModule: string;
  onUnlocked:   () => void;
}

export function RecordLockBanner({ record, entityModule, onUnlocked }: Props) {
  const user              = useAuthStore((s) => s.user);
  const [showModal, setShowModal] = useState(false);

  if (!record?.isLocked) return null;

  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  return (
    <>
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4">
        <span className="text-amber-500 text-lg">&#128274;</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Record Locked
          </p>
          {record.lockReason && (
            <p className="text-xs text-amber-700 mt-0.5">{record.lockReason}</p>
          )}
          {!isAdmin && (
            <p className="text-xs text-amber-600 mt-0.5">Contact an administrator to make changes.</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md"
          >
            Unlock Record
          </button>
        )}
      </div>

      {showModal && (
        <UnlockModal
          entityModule={entityModule}
          entityId={String(record._id)}
          onClose={() => setShowModal(false)}
          onUnlocked={onUnlocked}
        />
      )}
    </>
  );
}
