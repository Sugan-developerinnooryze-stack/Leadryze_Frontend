import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/connectors';
const KEY  = ['connectors'] as const;

export interface ConnectorSummary {
  _id: string;
  name: string;
  type: 'mongodb' | 'mysql' | 'postgresql' | 'rest' | 'hubspot' | 'zoho' | 'salesforce';
  isActive: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed';
  lastSyncAt?: string | null;
  syncError?: string | null;
}

export function useConnectorsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => (r.data.data ?? []) as ConnectorSummary[]),
  });
}
