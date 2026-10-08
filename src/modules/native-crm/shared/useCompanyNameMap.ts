import { useMemo } from 'react';
import { useCompaniesListQuery } from '../../crm/queries/companies.queries';

/** Resolves a native-crm Company's _id to its display name — mirrors
 * useUserNameMap/useStaffNameMap's own reasoning, one level up (Companies,
 * for the new 'companySelect' field type). */
export function useCompanyNameMap(): Map<string, string> {
  const { data } = useCompaniesListQuery({ limit: 500 });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.items ?? []) {
      map.set(c._id, c.name ?? '');
    }
    return map;
  }, [data]);
}
