import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/custom-form-templates';
const KEY  = ['native-crm', 'custom-form-templates'] as const;

export interface IFormField {
  key:           string;
  label:         string;
  fieldType:     'text' | 'number' | 'currency' | 'date' | 'email' | 'phone'
               | 'textarea' | 'dropdown' | 'image' | 'images' | 'formula'
               | 'radio' | 'multi_select' | 'boolean' | 'rating' | 'url' | 'time' | 'datetime'
               | 'cascade_dropdown' | 'table';
  options?:      string[];
  parentKey?:    string;
  parentValues?: string[];
  formula?:      string;
  required?:     boolean;
  order:         number;
}

export interface CustomFormTemplate {
  _id:          string;
  name:         string;
  description?: string;
  fields:       IFormField[];
}

export function useCustomFormTemplatesQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      api.get(BASE).then((r) => (r.data.data ?? []) as CustomFormTemplate[]),
  });
}

export function useCustomFormTemplateCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CustomFormTemplate, '_id'>) => api.post(BASE, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomFormTemplateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomFormTemplate> }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomFormTemplateDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
