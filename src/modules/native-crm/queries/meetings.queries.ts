import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/meetings';
const KEY  = ['native-crm', 'meetings'] as const;

interface MeetingFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  upcoming?: boolean;
}

export interface MeetingSummary {
  _id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  attendees?: string[];
  meetingStatus: 'scheduled' | 'completed' | 'cancelled';
  assignedStaffName?: string;
}

interface Meta { total: number; page: number; totalPages: number; }

/** General list hook, not just for "today's schedule" — matches the
 * established per-module query-file convention. Backend has no date-range
 * param yet, only a boolean `upcoming` (see meeting.service.ts) — the
 * "is it today" filter is applied by the caller after fetching. */
export function useMeetingsQuery(params?: MeetingFilters) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as MeetingSummary[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}
