import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

export type CredentialEntity = 'staffs' | 'customers';

export interface AppCredentials {
  clientId:    string;
  username:    string;
  password:    string;
  generatedAt: string | null;
  lastLoginAt: string | null;
}

const base = (entity: CredentialEntity, id: string) =>
  `/api/v1/native-crm/${entity}/${id}/credentials`;

const key = (entity: CredentialEntity, id: string) =>
  ['native-crm', entity, id, 'credentials'] as const;

export function useAppCredentialsQuery(entity: CredentialEntity, id: string) {
  return useQuery({
    queryKey: key(entity, id),
    queryFn: () => api.get(base(entity, id)).then((r) => r.data.data as AppCredentials),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useAppCredentialsUpdate(entity: CredentialEntity, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username?: string; password?: string }) =>
      api.patch(base(entity, id), data).then((r) => r.data.data as AppCredentials),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(entity, id) }),
  });
}

export function useAppPasswordRegenerate(entity: CredentialEntity, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(`${base(entity, id)}/regenerate`).then((r) => r.data.data as AppCredentials),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(entity, id) }),
  });
}
