import { QueryClient } from '@tanstack/react-query';

// Single, app-lifetime instance — created here (not inline in main.tsx) so
// auth.store.ts can import and clear it on login/logout. Query keys
// throughout the app are NOT tenant-scoped (no tenantId/userId segment), so
// without an explicit clear, switching accounts in the same tab can
// instantly reuse the PREVIOUS tenant's cached dashboard/CRM data for up to
// `staleTime`, before any new request is even made — a real, confirmed
// cross-tenant stale-data bug, not a hypothetical one.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   60 * 1000,
      retry:       1,
      refetchOnWindowFocus: false,
    },
  },
});
