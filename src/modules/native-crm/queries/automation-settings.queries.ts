import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/automation-settings';
const KEY  = ['native-crm', 'automation-settings'] as const;

/** Emergency tenant-wide automation kill switch (Phase 5) — distinct from a
 * single flow's own `enabled` boolean: this stops EVERY flow AND every
 * Simple Mode rule for the tenant, not one flow. `lastChangedBy`/
 * `lastChangedAt` are sourced server-side from the mandatory audit trail
 * (automation.kill_switch.pause/.resume) every toggle writes, not a
 * separate denormalized field. */
export interface AutomationSettings {
  automationsPaused: boolean;
  lastChangedBy: string | null;
  lastChangedAt: string | null;
}

export function useAutomationSettingsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => r.data.data as AutomationSettings),
  });
}

export function useUpdateAutomationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (automationsPaused: boolean) =>
      api.patch(BASE, { automationsPaused }).then((r) => r.data.data as AutomationSettings),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
