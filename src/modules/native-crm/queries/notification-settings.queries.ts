import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/notification-settings';
const KEY  = ['native-crm', 'notification-settings'] as const;

export interface NotificationSettings {
  reminderWindowMinutes:    number;
  sendOnCreateConfirmation: boolean;
  emailEnabled:             boolean;
  smsEnabled:               boolean;
}

export function useNotificationSettingsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => (r.data.data ?? {}) as NotificationSettings),
  });
}

export function useNotificationSettingsUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationSettings>) => api.put(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
