import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBranchStore, Branch } from '../../stores/branch.store';
import { useAuthStore } from '../../stores/auth.store';
import { useBranchesQuery } from '../../modules/native-crm/queries/branch.queries';

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];

export function BranchSwitcher() {
  const user          = useAuthStore((s) => s.user);
  // Filtered here (not trusted pre-filtered from the store) — the store is
  // shared globally, and FSSettingsPage populates it with inactive
  // companies included too (so it can offer a Reactivate action), so this
  // dropdown must defensively exclude them itself, same as every other
  // consumer of this store (FSDrawer, ContractFormDrawer, CompanyFilterBar,
  // LeadsPage) already does.
  const { currentBranch, setBranch, branches: allBranches } = useBranchStore();
  const branches = allBranches.filter((b) => b.status === 'active');
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

  // Same underlying state as FS Settings' own "Default Company" tab (no
  // X-Branch-Id header sent = no branch filter applied anywhere) — labeled
  // to make that connection obvious, without changing what selecting it
  // actually does (still shows/creates records across every company).
  const label = currentBranch?.branchName ?? 'All Branches (Default Company)';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors min-w-[160px] max-w-[220px]"
      >
        <span className="text-base">&#127963;</span>
        <span className="truncate flex-1 text-left">{label}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {isAdmin && (
            <>
              <button
                onClick={() => selectBranch(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors ${!currentBranch ? 'font-semibold text-ryze-600 dark:text-ryze-400' : 'text-text-primary'}`}
              >
                {!currentBranch && <span className="text-ryze-500">&#10003;</span>}
                {!!currentBranch && <span className="w-4" />}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">All Branches</span>
                  <span className="block text-xs text-text-muted font-normal">a.k.a. "Default Company" in FS Settings</span>
                </span>
                <span className="text-xs text-text-muted shrink-0">Admin view</span>
              </button>
              {branches.length > 0 && <div className="mx-2 border-t border-border my-1" />}
            </>
          )}

          {branches.map((b) => (
            <button
              key={b._id}
              onClick={() => selectBranch(b)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors ${currentBranch?._id === b._id ? 'font-semibold text-ryze-600 dark:text-ryze-400' : 'text-text-primary'}`}
            >
              {currentBranch?._id === b._id ? <span className="text-ryze-500">&#10003;</span> : <span className="w-4" />}
              <span className="flex-1 truncate">{b.branchName}</span>
              {b.city && <span className="text-xs text-text-muted shrink-0">{b.city}</span>}
            </button>
          ))}

          {branches.length === 0 && !isAdmin && (
            <p className="px-3 py-2 text-sm text-text-muted">No branches assigned</p>
          )}

          {isAdmin && (
            <>
              <div className="mx-2 border-t border-border my-1" />
              <button
                onClick={() => { setOpen(false); navigate('/native-crm/branches'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-ryze-600 dark:text-ryze-400 hover:bg-ryze-50 dark:hover:bg-ryze-900/20 transition-colors"
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
