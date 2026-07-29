import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/email-logs';
const KEY  = ['native-crm', 'email-logs'] as const;

export type EmailLogChannel = 'email' | 'sms' | 'whatsapp';
export type EmailLogKind    = 'on_create_confirmation' | 'reminder';
export type EmailLogStatus  = 'sent' | 'failed' | 'skipped';

export interface EmailLogItem {
  _id:                string;
  channel:             EmailLogChannel;
  kind:                EmailLogKind;
  sourceModule:        'call' | 'meeting' | 'task' | 'ticket';
  sourceId:            string;
  relatedModule?:      string;
  relatedId?:          string;
  relatedLabel?:       string;
  recipientName?:      string;
  recipientEmail?:     string;
  recipientPhone?:     string;
  subject?:            string;
  bodyPreview?:        string;
  status:              EmailLogStatus;
  errorMessage?:       string;
  providerMessageId?:  string;
  sentAt:              string;
}

interface Meta { total: number; page: number; totalPages: number; }

export interface EmailLogFilters {
  channel?: string;
  kind?:    string;
  status?:  string;
  from?:    string;
  to?:      string;
  page?:    number;
  limit?:   number;
}

export function useEmailLogsQuery(filters: EmailLogFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () =>
      api.get(BASE, { params: filters }).then((r) => ({
        items: (r.data.data ?? []) as EmailLogItem[],
        meta:  (r.data.meta ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}
