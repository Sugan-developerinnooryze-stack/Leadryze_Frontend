import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useBranchStore } from '../../../stores/branch.store';

const BASE = '/api/v1/native-crm/fs-settings';
const KEY  = ['native-crm', 'fs-settings'] as const;

// Response is scoped server-side by the X-Branch-Id header (see api.ts's
// request interceptor + backend's resolveBranch middleware), but the query
// KEY itself didn't encode which company that was — so react-query treated
// every company's settings as the exact same cache entry. Switching
// companies changed the header but kept showing whichever company's data
// had been cached last, since nothing told react-query the two are
// different queries. Same root cause as the branch-store race fixed
// earlier: state that varies per-company needs its scope encoded in the
// key/store, not left to an out-of-band header alone.
function useFsSettingsQueryKey(base: readonly unknown[]) {
  const branchId = useBranchStore((s) => s.currentBranch?._id ?? null);
  return [...base, branchId] as const;
}

export function useFSSettingsQuery() {
  const queryKey = useFsSettingsQueryKey(KEY);
  return useQuery({
    queryKey,
    queryFn: () => api.get(BASE).then((r) => (r.data.data ?? {}) as any),
  });
}

export interface FsSettingsDefaults {
  branchId: string | null;
  taxPercentage: number;
  discountPercentage: number;
}

/** One entry per active Company plus a `branchId: null` entry for "Default
 * Company" — backs the "Company" branch-select field's auto-fill of
 * Discount %/GST % on Quotations/Work Orders/Invoices/Contracts (see
 * FSDrawer.tsx). Fetched once alongside the other lookup lists, not
 * per-selection. */
export function useFsSettingsDefaultsQuery() {
  return useQuery({
    queryKey: [...KEY, 'defaults'],
    queryFn: () => api.get(`${BASE}/defaults`).then((r) => (r.data.data ?? []) as FsSettingsDefaults[]),
  });
}

export function useFSSettingsUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useFSSettingsUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ field, file }: { field: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('field', field);
      return api.post(`${BASE}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

const PREF_KEY = ['native-crm', 'fs-settings', 'template-preferences'] as const;

export interface TemplateSections {
  services: boolean;
  parts:    boolean;
  totals:   boolean;
  notes:    boolean;
  terms:    boolean;
}

export interface TemplatePreferenceEntry {
  variant:  string;
  sections: TemplateSections;
}

export type TemplatePreferences = Record<string, TemplatePreferenceEntry>;

export function useTemplatePreferencesQuery() {
  // Same per-company cache-key gap as useFSSettingsQuery above.
  const queryKey = useFsSettingsQueryKey(PREF_KEY);
  return useQuery({
    queryKey,
    queryFn: () =>
      api.get(`${BASE}/template-preferences`).then(
        (r) => (r.data.data ?? {}) as TemplatePreferences
      ),
  });
}

export function useTemplatePreferencesUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, { variant?: string; sections?: Partial<TemplateSections> }>) =>
      api.put(`${BASE}/template-preferences`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREF_KEY }),
  });
}
