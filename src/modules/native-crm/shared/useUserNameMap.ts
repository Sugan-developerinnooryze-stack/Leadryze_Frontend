import { useMemo } from 'react';
import { useUsersListQuery } from '../queries/users.queries';

/** Resolves a platform User's _id to their display name — same lookup
 * dataset the Team "Manager" picker already fetches, reused here for
 * display. Mirrors useStaffNameMap's own reasoning exactly, one level up
 * (Users, not Field-Service Staff). */
export function useUserNameMap(): Map<string, string> {
  const { data } = useUsersListQuery({ limit: 500 });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const u of data?.items ?? []) {
      map.set(u._id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email);
    }
    return map;
  }, [data]);
}
