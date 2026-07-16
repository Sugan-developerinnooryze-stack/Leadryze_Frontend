import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/workflow-templates';
const KEY  = ['native-crm', 'workflow-templates'] as const;

export interface WorkflowStep {
  docType: 'quotation' | 'contract' | 'workorder' | 'invoice';
  label:   string;
  order:   number;
  color:   string;
}

export interface WorkflowTemplate {
  _id:       string;
  name:      string;
  isDefault: boolean;
  steps:     WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export function useWorkflowTemplatesQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => (r.data.data?.items ?? []) as WorkflowTemplate[]),
  });
}

export function useWorkflowTemplateCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkflowTemplate>) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useWorkflowTemplateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowTemplate> }) =>
      api.put(`${BASE}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useWorkflowTemplateDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useWorkflowTemplateSetDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`${BASE}/${id}/set-default`, {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
