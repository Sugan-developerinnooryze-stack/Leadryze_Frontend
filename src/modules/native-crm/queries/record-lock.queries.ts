import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/record-lock';

export interface LockStatus {
  isLocked:   boolean;
  lockedAt?:  string;
  lockedBy?:  string;
  lockReason?: string;
}

export interface LockAuditEntry {
  _id:          string;
  tenantId:     string;
  entityModule: string;
  entityId:     string;
  action:       'locked' | 'unlocked';
  reason:       string;
  performedBy:  string;
  performedAt:  string;
}

export function useLockStatusQuery(entityModule: string, id: string | null) {
  return useQuery<LockStatus>({
    queryKey:  ['native-crm', 'lock-status', entityModule, id],
    queryFn:   () => api.get(`${BASE}/${entityModule}/${id}/status`).then((r) => r.data.data),
    enabled:   !!id,
    staleTime: 10_000,
  });
}

export function useLockAuditQuery(entityModule: string, id: string | null) {
  return useQuery<LockAuditEntry[]>({
    queryKey: ['native-crm', 'lock-audit', entityModule, id],
    queryFn:  () => api.get(`${BASE}/${entityModule}/${id}/audit`).then((r) => r.data.data),
    enabled:  !!id,
  });
}

export function useTenantLockAuditQuery(filters?: { module?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['native-crm', 'lock-audit', 'tenant', filters],
    queryFn:  () => api.get(`${BASE}/audit`, { params: filters }).then((r) => r.data.data),
  });
}

export function useLockRecord(entityModule: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`${BASE}/${entityModule}/${id}/lock`, { reason }).then((r) => r.data.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['native-crm', entityModule] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'lock-status', entityModule, id] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'lock-audit'] });
    },
  });
}

export function useUnlockRecord(entityModule: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`${BASE}/${entityModule}/${id}/unlock`, { reason }).then((r) => r.data.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['native-crm', entityModule] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'lock-status', entityModule, id] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'lock-audit'] });
    },
  });
}
