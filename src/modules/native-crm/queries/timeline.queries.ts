import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

export function useEntityTimelineQuery(entityModule: string, entityId: string | null | undefined) {
  return useQuery({
    queryKey: ['native-crm', 'timeline', entityModule, entityId],
    queryFn: () =>
      api
        .get(`/api/v1/native-crm/timeline/${entityModule}/${entityId}`, { params: { limit: 50 } })
        .then((r) => (r.data.data ?? []) as any[]),
    enabled: !!entityId,
  });
}
