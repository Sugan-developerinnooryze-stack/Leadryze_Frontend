import { useEffect, useRef, useState } from 'react';
import {
  ChevronUpIcon, ChevronDownIcon, ChevronRightIcon, TrashIcon, PlusIcon, CheckIcon,
  Squares2X2Icon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
  usePipelineStages, useUpdatePipelineStages, PipelineModule, BuiltInPipelineModule, PipelineStage,
} from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useCustomModulesQuery } from '../../../modules/native-crm/queries/custom-modules.queries';

const BUILT_IN_MODULES: { key: BuiltInPipelineModule; label: string }[] = [
  { key: 'lead',       label: 'Leads' },
  { key: 'deal',       label: 'Deals' },
  { key: 'task',       label: 'Tasks' },
  { key: 'ticket',     label: 'Tickets' },
  { key: 'quotation',  label: 'Quotations' },
  { key: 'workorder',  label: 'Work Orders' },
  { key: 'contract',   label: 'Contracts' },
  { key: 'invoice',    label: 'Invoices' },
];

const PALETTE = ['#6366f1', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#ef4444', '#94a3b8', '#64748b'];

// Each module's own set of meaningful semantic outcomes — must match the
// exact tag strings the backend resolves via getOutcomeStageKey (Task has no
// automation hooked to an outcome tag, so it offers none here). Custom
// Modules have no built-in business logic keyed to an outcome tag either —
// their automation rules trigger on the stage key itself. Every module
// (including these) still gets the standalone Terminal toggle below,
// independent of this list.
const OUTCOME_OPTIONS: Record<BuiltInPipelineModule, { value: string; label: string }[]> = {
  lead:      [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }],
  deal:      [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }],
  task:      [],
  // 'resolved'/'closed' drive ticket.service.ts's resolvedAt/closedAt SLA
  // stamping (getOutcomeStageKey, rename-safe) — a tenant who edits their
  // Ticket pipeline needs to be able to re-point these tags to whichever
  // stage they rename/add, or SLA stamping silently keeps falling back to
  // the seeded 'resolved'/'closed' keys forever.
  ticket:    [{ value: 'resolved', label: 'Resolved (SLA resolution stamp)' }, { value: 'closed', label: 'Closed (SLA closure stamp)' }],
  quotation: [{ value: 'approved', label: 'Approved' }],
  workorder: [
    { value: 'scheduled', label: 'Scheduled (auto-generated)' },
    { value: 'completed',  label: 'Completed' },
    { value: 'cancelled',  label: 'Cancelled' },
  ],
  contract:  [{ value: 'active', label: 'Active (drives auto-scheduling)' }],
  invoice:   [{ value: 'paid', label: 'Paid' }],
};

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `stage_${Date.now()}`;
}

/* ── Toggle (matches AutomationRulesPage's pill-switch idiom) ────────────── */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          on ? 'bg-brand-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

/* ── Pipeline preview strip ───────────────────────────────────────────────── */
function PipelinePreview({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5">
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: `${s.color}20`, color: s.color }}
          >
            {s.label}
          </span>
          {i < stages.length - 1 && <ChevronRightIcon className="h-3 w-3 text-gray-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ── StageCard ────────────────────────────────────────────────────────────── */
function StageCard({
  stage, active, canOutcome, outcomeOptions, onActivate, onDone, onChange, onRemove,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  onDragStart, onDragEnter, onDragEnd,
}: {
  stage:          PipelineStage;
  active:         boolean;
  canOutcome:     boolean;
  outcomeOptions: { value: string; label: string }[];
  onActivate:     () => void;
  onDone:         () => void;
  onChange:       (patch: Partial<PipelineStage>) => void;
  onRemove:       () => void;
  onMoveUp:       () => void;
  onMoveDown:     () => void;
  canMoveUp:      boolean;
  canMoveDown:    boolean;
  onDragStart:    () => void;
  onDragEnter:    () => void;
  onDragEnd:      () => void;
}) {
  if (!active) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onClick={onActivate}
        className="group flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer"
      >
        <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-lg leading-none select-none" title="Drag to reorder">⠿</span>
        <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={!canMoveUp} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
            <ChevronUpIcon className="h-3 w-3" />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
            <ChevronDownIcon className="h-3 w-3" />
          </button>
        </div>
        <span className="h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: stage.color }} />
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{stage.label}</span>
        {stage.isTerminal && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
            Terminal{stage.outcome ? ` · ${stage.outcome}` : ''}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-brand-300 shadow-md" onDragOver={(e) => e.preventDefault()}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={stage.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-8 rounded-lg border border-gray-200 shrink-0 cursor-pointer"
            title="Custom color"
          />
          <div className="flex items-center gap-1.5">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => onChange({ color: hex })}
                className={`h-5 w-5 rounded-full shrink-0 transition-transform hover:scale-110 ${stage.color === hex ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Stage label</label>
          <input
            autoFocus
            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={stage.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>

        <div className="flex items-start gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          <LockClosedIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            Internal key: <code className="text-gray-600 font-mono">{stage.key}</code> — renaming the label above never
            changes this. Automations and reports depend on it staying fixed.
          </p>
        </div>

        {canOutcome && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Reporting outcome</label>
            <select
              value={stage.outcome ?? ''}
              onChange={(e) => onChange({ outcome: e.target.value || null, isTerminal: e.target.value ? true : stage.isTerminal })}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Regular stage</option>
              {outcomeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <Toggle
          label="Terminal stage (a record stops moving once it reaches here)"
          on={stage.isTerminal}
          onChange={(v) => onChange({ isTerminal: v })}
        />

        <div className="flex justify-end pt-1">
          <button
            onClick={onDone}
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function PipelineSettingsPage() {
  const [module, setModule] = useState<PipelineModule>('lead');
  const { stages: loaded, isLoading } = usePipelineStages(module);
  const updateMut = useUpdatePipelineStages(module);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const dragSrc = useRef<number | null>(null);

  // Custom Modules only show up here once a tenant has designated one of
  // their fields as "the pipeline field" (CustomModuleBuilderPage) — no
  // pipeline field configured means nothing to edit on this page for it.
  const { data: customModules = [] } = useCustomModulesQuery();
  const customModulesWithPipeline = customModules.filter((m) => m.pipelineFieldKey);
  const MODULES: { key: PipelineModule; label: string }[] = [
    ...BUILT_IN_MODULES,
    ...customModulesWithPipeline.map((m) => ({ key: `custom:${m.slug}` as PipelineModule, label: m.name })),
  ];
  const outcomeOptionsFor = (m: PipelineModule) => OUTCOME_OPTIONS[m as BuiltInPipelineModule] ?? [];

  // Reset local editable copy whenever the module changes or fresh data loads
  // (but not while the user has unsaved edits, so a background refetch can't
  // clobber in-progress typing).
  useEffect(() => {
    if (!dirty) setStages(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, module]);

  const switchModule = (m: PipelineModule) => {
    setModule(m);
    setDirty(false);
    setActiveKey(null);
  };

  const patch = (i: number, changes: Partial<PipelineStage>) => {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...changes } : s)));
    setDirty(true);
  };

  const move = (i: number, dir: -1 | 1) => {
    setStages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };

  const addStage = () => {
    const label = 'New Stage';
    setStages((prev) => [
      ...prev,
      { key: slugify(`${label}_${prev.length}`), label, color: PALETTE[prev.length % PALETTE.length], order: prev.length, isTerminal: false, outcome: null, isActive: true },
    ]);
    setDirty(true);
  };

  const removeStage = (i: number) => {
    // Soft-remove only — deactivate rather than delete, so historic records
    // still referencing this stage key keep displaying correctly.
    patch(i, { isActive: false });
  };

  const restoreStage = (i: number) => patch(i, { isActive: true });

  const handleSave = async () => {
    await updateMut.mutateAsync(stages);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const activeStages = stages.filter((s) => s.isActive);
  const removedStages = stages.filter((s) => !s.isActive);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Squares2X2Icon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Pipeline &amp; Stages</h1>
            <p className="text-xs text-gray-500">Each module's own stage list — add, rename, reorder, or retire a stage without a code change</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending || !dirty}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <><CheckIcon className="h-4 w-4" /> Saved</> : updateMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 shrink-0 overflow-x-auto">
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => switchModule(m.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
              module === m.key ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : activeStages.length === 0 && removedStages.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <Squares2X2Icon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">No stages configured yet</p>
              <p className="text-xs text-gray-500 mb-4">Add the first stage to start shaping this module's pipeline.</p>
              <button
                onClick={addStage}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" /> Add first stage
              </button>
            </div>
          ) : (
            <>
              <PipelinePreview stages={activeStages} />

              <div className="space-y-2">
                {activeStages.map((stage) => {
                  const i = stages.indexOf(stage);
                  return (
                    <StageCard
                      key={stage.key}
                      stage={stage}
                      active={activeKey === stage.key}
                      canOutcome={outcomeOptionsFor(module).length > 0}
                      outcomeOptions={outcomeOptionsFor(module)}
                      onActivate={() => setActiveKey(stage.key)}
                      onDone={() => setActiveKey(null)}
                      onChange={(patchObj) => patch(i, patchObj)}
                      onRemove={() => removeStage(i)}
                      onMoveUp={() => move(i, -1)}
                      onMoveDown={() => move(i, 1)}
                      canMoveUp={i > 0}
                      canMoveDown={i < stages.length - 1}
                      onDragStart={() => { dragSrc.current = i; }}
                      onDragEnter={() => {
                        if (dragSrc.current === null || dragSrc.current === i) return;
                        const from = dragSrc.current;
                        dragSrc.current = i;
                        setStages((prev) => {
                          const arr = [...prev];
                          const [moved] = arr.splice(from, 1);
                          arr.splice(i, 0, moved);
                          return arr;
                        });
                        setDirty(true);
                      }}
                      onDragEnd={() => { dragSrc.current = null; }}
                    />
                  );
                })}
              </div>

              <button
                onClick={addStage}
                className="mt-3 w-full px-3 py-2.5 text-xs font-medium border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusIcon className="h-3.5 w-3.5" /> Add stage
              </button>

              {removedStages.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Removed (existing records keep their stage)</p>
                  <div className="space-y-1.5">
                    {removedStages.map((stage) => {
                      const i = stages.indexOf(stage);
                      return (
                        <div key={stage.key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 text-xs text-gray-400">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                          <span className="flex-1 truncate line-through">{stage.label}</span>
                          <button onClick={() => restoreStage(i)} className="text-brand-500 hover:text-brand-700 font-medium">Restore</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
