import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/pipeline-config';
const KEY  = ['native-crm', 'pipeline-config'] as const;

export type BuiltInPipelineModule = 'lead' | 'deal' | 'task' | 'ticket' | 'quotation' | 'workorder' | 'contract' | 'invoice';
/** Tenant-built Custom Modules share this same pipeline infrastructure via a
 * `custom:<slug>` module value — see backend's pipeline-config.model.ts. */
export type PipelineModule = BuiltInPipelineModule | `custom:${string}`;

export interface PipelineStage {
  key:        string;
  label:      string;
  color:      string;
  order:      number;
  isTerminal: boolean;
  // Semantic tag identifying this stage's business meaning (e.g. 'won',
  // 'approved', 'completed', 'active', 'paid'), independent of its
  // renameable key/label — resolved server-side via getOutcomeStageKey.
  outcome:    string | null;
  isActive:   boolean;
}

/** Tenant-configured pipeline stages for a module — falls back to
 * `fallback` (today's hardcoded defaults) while loading or on error, so
 * pages relying on this never render with an empty stage list. */
export function usePipelineStages(module: PipelineModule | undefined, fallback: PipelineStage[] = []) {
  const query = useQuery({
    queryKey: [...KEY, module],
    queryFn: () => api.get(`${BASE}/${module}`).then((r) => (r.data.data ?? []) as PipelineStage[]),
    enabled: !!module,
  });
  const stages = (query.data && query.data.length > 0 ? query.data : fallback).filter((s) => s.isActive);
  return { ...query, stages };
}

export function useUpdatePipelineStages(module: PipelineModule) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stages: PipelineStage[]) => api.put(`${BASE}/${module}`, { stages }).then((r) => r.data.data as PipelineStage[]),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, module] }),
  });
}
