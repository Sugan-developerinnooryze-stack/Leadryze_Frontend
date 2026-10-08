import { useAuthStore } from '../../../stores/auth.store';
import { useFeatureFlagsStore } from '../../../stores/featureFlags.store';
import type { CalendarEventTypeKey } from './calendar.types';

const FLAG_KEY: Record<CalendarEventTypeKey, 'fs_workorders' | 'fs_invoices' | 'fs_contracts' | 'fs_quotations'> = {
  workorder: 'fs_workorders',
  invoice:   'fs_invoices',
  contract:  'fs_contracts',
  quotation: 'fs_quotations',
};
const PERM_PREFIX: Record<CalendarEventTypeKey, string> = {
  workorder: 'fs.workorders',
  invoice:   'fs.invoices',
  contract:  'fs.contracts',
  quotation: 'fs.quotations',
};

// Same wildcard-permission check Sidebar.tsx already uses (not exported
// there — small enough to mirror exactly rather than restructure a shared
// export for one extra consumer).
function hasWildcard(perms: string[], key: string): boolean {
  if (!key) return true;
  if (perms.includes(key)) return true;
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    if (perms.includes(parts.slice(0, i).join('.') + '.*')) return true;
  }
  return false;
}

/** The Calendar's own RBAC/feature-flag gate for its 4 modules — a module
 * must be both licensed (flag) and permitted (RBAC) to appear in filters,
 * events, the legend or the Create menu, and a disabled/unauthorized module
 * must never trigger a network request for it either. This mirrors
 * (not duplicates business logic of) the backend's own requireModuleEnabled
 * + requirePermission('fs.*.view') middleware, which remains the real
 * enforcement boundary — this is purely so the UI doesn't show, or fetch,
 * what the backend would refuse anyway. */
export function useModuleAccess() {
  const { user, permissions } = useAuthStore();
  const { flags } = useFeatureFlagsStore();
  const isFullAccess = !user || user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || permissions === null;

  const canView = (mod: CalendarEventTypeKey): boolean => {
    if (flags[FLAG_KEY[mod]] === false) return false;
    return isFullAccess || hasWildcard(permissions ?? [], `${PERM_PREFIX[mod]}.view`);
  };
  const canCreate = (mod: CalendarEventTypeKey): boolean => {
    if (flags[FLAG_KEY[mod]] === false) return false;
    return isFullAccess || hasWildcard(permissions ?? [], `${PERM_PREFIX[mod]}.create`);
  };

  return { canView, canCreate };
}
