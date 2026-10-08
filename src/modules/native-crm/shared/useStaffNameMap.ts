import { useMemo } from 'react';
import { useStaffsListQuery } from '../queries/staffs.queries';

/** Resolves a Staff's own business-friendly staffId (e.g. "9A218C-ST-0001")
 * to their display name — same lookup dataset the create/edit form's
 * `type: 'multilookup', lookupModule: 'staffs'` field already fetches,
 * reused here for table display. Mirrors useCustomerNameMap's own reasoning. */
export function useStaffNameMap(): Map<string, string> {
  const { data } = useStaffsListQuery({ page: 1, limit: 500 });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data?.items ?? []) {
      if (s.staffId) map.set(s.staffId, [s.firstName, s.lastName].filter(Boolean).join(' '));
    }
    return map;
  }, [data]);
}
