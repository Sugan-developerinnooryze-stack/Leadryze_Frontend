import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { Branch, useBranchStore } from '../../../stores/branch.store';

const BASE = '/api/v1/native-crm/branches';
const KEY  = ['native-crm', 'branches'] as const;

export function useBranchesQuery(includeInactive = false) {
  const setBranches = useBranchStore((s) => s.setBranches);
  return useQuery({
    queryKey: [...KEY, { includeInactive }],
    queryFn: () =>
      api.get(BASE, { params: includeInactive ? { includeInactive: true } : {} }).then((r) => {
        const items: Branch[] = r.data.data?.items ?? [];
        // Only the default (active-only) fetch syncs the shared store — this
        // store is read globally (header BranchSwitcher, every Company
        // picker on Quotations/Invoices/Work Orders/Contracts,
        // CompanyFilterBar) as "the selectable companies," always assumed
        // active-only by every one of those consumers. A page that opts
        // into includeInactive:true (FSSettingsPage, to show/reactivate
        // deactivated companies) must NOT overwrite that shared list with
        // inactive ones mixed in — this hook's own `data.items` already
        // gives that caller everything it needs without touching global
        // state. Before this guard, whichever of the two queries last
        // resolved silently won, so an inactive company could flicker
        // between showing and vanishing depending on fetch timing (a real
        // reported bug — the header's own useBranchesQuery() call runs on
        // every page alongside this one).
        if (!includeInactive) setBranches(items);
        return {
          items,
          plan:  r.data.data?.plan  as string,
          used:  r.data.data?.used  as number,
          limit: r.data.data?.limit as number | null,
        };
      }),
  });
}

export function useBranchQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn:  () => api.get(`${BASE}/${id}`).then((r) => r.data.data as Branch),
    enabled:  !!id,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Branch> & { branchName: string }) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Branch> }) => api.put(`${BASE}/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeactivateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
