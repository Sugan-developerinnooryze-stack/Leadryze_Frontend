import { useMemo } from 'react';
import { useTeamsListQuery } from '../queries/teams.queries';

/** Resolves a Team's own business-friendly teamId (e.g. "9A218C-TM-0001")
 * to its display name — same lookup dataset the create/edit form's
 * `type: 'lookup', lookupModule: 'teams'` field already fetches, reused
 * here for table display. Mirrors useCustomerNameMap's own reasoning. */
export function useTeamNameMap(): Map<string, string> {
  const { data } = useTeamsListQuery({ page: 1, limit: 500 });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const t of data?.items ?? []) {
      if (t.teamId) map.set(t.teamId, t.name);
    }
    return map;
  }, [data]);
}
