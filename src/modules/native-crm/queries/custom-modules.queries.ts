import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface CascadeNode {
  name:     string;
  children: CascadeNode[];
}

export type CustomModuleFieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'currency'
  | 'date' | 'datetime' | 'textarea' | 'boolean' | 'url' | 'rating'
  | 'select' | 'multiselect' | 'relationship'
  | 'image' | 'images'
  | 'categoryselect'
  | 'table';

/** One column of a Table/Grid field. Formula columns compute from other columns in the same row. */
export interface ITableColumn {
  key:      string;
  label:    string;
  type:     'text' | 'number' | 'dropdown' | 'formula';
  options?: string[];
  formula?: string;
}

export interface ICustomModuleField {
  key:       string;
  label:     string;
  fieldType: CustomModuleFieldType;
  required?: boolean;
  options?:  string[];
  meta?: {
    targetModule?:     string;
    lookupLabelField?: string;
    lookupValueField?: string;
    cascadeTree?:      CascadeNode[];
    levelNames?:       string[];
    subFields?:        string[];
    columns?:          ITableColumn[];
  };
  order: number;
}

export interface CustomModuleDef {
  _id:          string;
  slug:         string;
  name:         string;
  singularName: string;
  icon:         string;
  color:        string;
  showInSidebar: boolean;
  menuOrder:    number;
  fields:       ICustomModuleField[];
  createdAt:    string;
  updatedAt:    string;
}

export interface CustomRecord {
  _id:        string;
  moduleSlug: string;
  numId:      number;
  recordId:   string;
  data:       Record<string, unknown>;
  createdAt:  string;
  updatedAt:  string;
}

/* ── Module Definition Queries ────────────────────────────────────────────── */

export function useCustomModulesQuery() {
  return useQuery<CustomModuleDef[]>({
    queryKey: ['custom-modules'],
    queryFn:  async () => {
      const res: any = await api.get('/api/v1/custom-modules');
      return res.data.data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCustomModuleBySlugQuery(slug: string) {
  return useQuery<CustomModuleDef>({
    queryKey: ['custom-modules', 'slug', slug],
    queryFn:  async () => {
      const res: any = await api.get(`/api/v1/custom-modules/by-slug/${slug}`);
      return res.data.data;
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useCustomModuleCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CustomModuleDef>) =>
      api.post('/api/v1/custom-modules', dto).then((res: any) => res.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules'] }),
  });
}

export function useCustomModuleUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomModuleDef> }) =>
      api.put(`/api/v1/custom-modules/${id}`, data).then((res: any) => res.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules'] }),
  });
}

export function useCustomModuleDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/custom-modules/${id}`).then((res: any) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules'] }),
  });
}

/* ── Record Queries ───────────────────────────────────────────────────────── */

interface ListOpts {
  page?:   number;
  limit?:  number;
  search?: string;
}

export function useCustomRecordsQuery(slug: string, opts: ListOpts = {}) {
  const { page = 1, limit = 20, search } = opts;
  return useQuery({
    queryKey: ['custom-modules', 'records', slug, page, limit, search],
    queryFn:  async () => {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      const res: any = await api.get(`/api/v1/custom-modules/${slug}/records`, { params });
      return {
        items: (res.data.data ?? []) as CustomRecord[],
        meta:  res.data.meta  ?? { total: 0, page: 1, totalPages: 1 },
      };
    },
    enabled: !!slug,
    staleTime: 10_000,
  });
}

export function useCustomRecordCreate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/api/v1/custom-modules/${slug}/records`, data).then((res: any) => res.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules', 'records', slug] }),
  });
}

export function useCustomRecordUpdate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/api/v1/custom-modules/${slug}/records/${id}`, data).then((res: any) => res.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules', 'records', slug] }),
  });
}

export function useCustomRecordDelete(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/custom-modules/${slug}/records/${id}`).then((res: any) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-modules', 'records', slug] }),
  });
}
