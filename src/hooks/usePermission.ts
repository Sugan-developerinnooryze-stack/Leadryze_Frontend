import { useAuthStore } from '../stores/auth.store';

/**
 * Returns true if the current user has ALL of the specified permission keys.
 *
 * Rules:
 * - SUPER_ADMIN and TENANT_ADMIN always return true (full access).
 * - Users with no permissions array (null) return true (full access — legacy fast-path).
 * - Permission keys support wildcard fallback:
 *     'connector.zoho.accounts.view' → checks 'connector.zoho.*' → 'connector.*'
 *
 * Usage:
 *   const canDelete = usePermission('customers.delete');
 *   const canManage = usePermission('connector.zoho.accounts.edit');
 */
export function usePermission(...keys: string[]): boolean {
  const { user, permissions } = useAuthStore();

  if (!user) return false;

  // SUPER_ADMIN and TENANT_ADMIN always have full access
  if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return true;

  // null permissions = full access (legacy session or unassigned role)
  if (permissions === null) return true;

  return keys.every((key) => _hasKey(permissions, key));
}

/**
 * Returns true if the user has ANY of the specified permission keys.
 * Useful for showing a section when at least one action is permitted.
 */
export function useAnyPermission(...keys: string[]): boolean {
  const { user, permissions } = useAuthStore();

  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return true;
  if (permissions === null) return true;

  return keys.some((key) => _hasKey(permissions, key));
}

function _hasKey(permissions: string[], key: string): boolean {
  if (permissions.includes(key)) return true;

  // Wildcard fallback: connector.zoho.accounts.view → connector.zoho.* → connector.*
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = parts.slice(0, i).join('.') + '.*';
    if (permissions.includes(wildcard)) return true;
  }

  return false;
}
