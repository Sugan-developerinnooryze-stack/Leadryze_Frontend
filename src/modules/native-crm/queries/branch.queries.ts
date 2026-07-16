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
        setBranches(items);
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
