import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/activity-feed';
const KEY  = ['native-crm', 'activity-feed'] as const;

export type ActivityKind = 'task' | 'ticket' | 'call' | 'meeting' | 'email';
export type RelatedModule = 'contact' | 'company' | 'deal' | 'customer' | 'quotation' | 'workorder' | 'contract';

export interface ActivityFeedItem {
  _id: string;
  kind: ActivityKind;
  at: string;
  [key: string]: unknown;
}

interface Meta { total: number; page: number; totalPages: number; }

export function useActivityFeedQuery(relatedModule: RelatedModule, relatedId: string, params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: [...KEY, relatedModule, relatedId, params],
    enabled: !!relatedId,
    queryFn: () =>
      api.get(BASE, { params: { relatedModule, relatedId, ...params } }).then((r) => ({
        items: (r.data.data ?? []) as ActivityFeedItem[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}
