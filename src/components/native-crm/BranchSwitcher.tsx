import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBranchStore, Branch } from '../../stores/branch.store';
import { useAuthStore } from '../../stores/auth.store';
import { useBranchesQuery } from '../../modules/native-crm/queries/branch.queries';

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];

export function BranchSwitcher() {
  const user          = useAuthStore((s) => s.user);
  const { currentBranch, setBranch, branches } = useBranchStore();
  const qc            = useQueryClient();
  const navigate      = useNavigate();
  const [open, setOpen] = useState(false);
  const ref           = useRef<HTMLDivElement>(null);

  useBranchesQuery();

  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectBranch(branch: Branch | null) {
    setBranch(branch);
    setOpen(false);
    qc.invalidateQueries();
  }

  const label = currentBranch?.branchName ?? 'All Branches';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[160px] max-w-[220px]"
      >
        <span className="text-base">&#127963;</span>
        <span className="truncate flex-1 text-left">{label}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {isAdmin && (
            <>
              <button
                onClick={() => selectBranch(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!currentBranch ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}
              >
                {!currentBranch && <span className="text-indigo-500">&#10003;</span>}
                {!!currentBranch && <span className="w-4" />}
                <span>All Branches</span>
                <span className="ml-auto text-xs text-gray-400">Admin view</span>
              </button>
              {branches.length > 0 && <div className="mx-2 border-t border-gray-100 dark:border-gray-700 my-1" />}
            </>
          )}

          {branches.map((b) => (
            <button
              key={b._id}
              onClick={() => selectBranch(b)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${currentBranch?._id === b._id ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}
            >
              {currentBranch?._id === b._id ? <span className="text-indigo-500">&#10003;</span> : <span className="w-4" />}
              <span className="flex-1 truncate">{b.branchName}</span>
              {b.city && <span className="text-xs text-gray-400 shrink-0">{b.city}</span>}
            </button>
          ))}

          {branches.length === 0 && !isAdmin && (
            <p className="px-3 py-2 text-sm text-gray-400">No branches assigned</p>
          )}

          {isAdmin && (
            <>
              <div className="mx-2 border-t border-gray-100 dark:border-gray-700 my-1" />
              <button
                onClick={() => { setOpen(false); navigate('/native-crm/branches'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <span>&#43;</span>
                <span>Manage Branches</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
