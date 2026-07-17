const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];

/**
 * Mirrors the backend's PII view-role gate (backend/src/platform/pii/pii.service.ts +
 * constants.ts) so the frontend can decide whether to offer features that need real,
 * unmasked contact data — e.g. pre-filling a customer's email/phone into a send form.
 * Roles outside this gate only ever see masked PII from the API, so anything built on
 * top of that data must be hidden for them rather than silently operating on garbage.
 */
export function canViewPII(module: string, settings: any, role: string | undefined): boolean {
  if (!role) return false;
  if (ADMIN_ROLES.includes(role)) return true;
  const viewRoles: string[] = settings?.piiConfig?.find((p: any) => p.module === module)?.viewRoles ?? [];
  return viewRoles.includes(role);
}
