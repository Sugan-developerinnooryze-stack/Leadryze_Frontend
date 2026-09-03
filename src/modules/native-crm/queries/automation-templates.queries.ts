import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import type { FlowNode, FlowEdge } from './automation-flows.queries';
import type { AutomationModule } from './automation-rules.queries';

const BASE = '/api/v1/native-crm/automation-templates';
const KEY  = ['native-crm', 'automation-templates'] as const;

/** A starter flow scaffold — never itself a trusted, executable flow (see
 * the backend's own doc comment, automation-template.model.ts). `tenantId:
 * null` means a system template (one of the 5 seeded starters, visible to
 * every tenant); a real tenant id means this tenant's own "saved as
 * template" flow. */
export interface AutomationTemplate {
  _id: string;
  tenantId: string | null;
  name: string;
  description?: string;
  category?: string;
  triggerModule?: AutomationModule;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
}

export function useAutomationTemplatesQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => r.data.data as AutomationTemplate[]),
  });
}

export function useAutomationTemplateQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as AutomationTemplate),
    enabled: !!id,
  });
}

// "Save as template" — sourceFlowId only, never raw nodes/edges (the
// backend fetches and copies the real, already-saved flow server-side).
export interface CreateTemplatePayload {
  sourceFlowId: string;
  name: string;
  description?: string;
  category?: string;
}

export function useCreateAutomationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplatePayload) => api.post(BASE, data).then((r) => r.data.data as AutomationTemplate),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAutomationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
