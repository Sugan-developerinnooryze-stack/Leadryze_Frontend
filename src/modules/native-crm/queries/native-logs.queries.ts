import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/native-logs';
const KEY  = ['native-crm', 'native-logs'] as const;

export interface NativeCrmLogEntry {
  _id:        string;
  tenantId:   string;
  actorId:    string;
  actorName:  string;
  actorRole:  string;
  action:     'create' | 'update' | 'delete' | 'error' | 'permission';
  module:     string;
  resourceId: string;
  before:     Record<string, unknown> | null;
  after:      Record<string, unknown> | null;
  changes:    Record<string, unknown> | null;
  error:      string | null;
  statusCode: number;
  ip:         string;
  url:        string;
  timestamp:  string;
}

export interface NativeLogsMeta {
  total:      number;
  page:       number;
  totalPages: number;
}

interface NativeLogsParams {
  page?:       number;
  limit?:      number;
  module?:     string;
  action?:     string;
  startDate?:  string;
  endDate?:    string;
  search?:     string;
}

export function useNativeLogsQuery(params: NativeLogsParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data?.items ?? []) as NativeCrmLogEntry[],
        meta:  (r.data.data?.meta  ?? { total: 0, page: 1, totalPages: 1 }) as NativeLogsMeta,
      })),
  });
}
