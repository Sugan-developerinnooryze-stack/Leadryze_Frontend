import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  BoltIcon, PencilSquareIcon, PlusIcon, TrashIcon,
  ArrowRightIcon, ListBulletIcon, Squares2X2Icon, ShareIcon,
} from '@heroicons/react/24/outline';
import {
  useAutomationRulesQuery, useUpdateAutomationRule, useDeleteAutomationRule,
  AutomationRule, AutomationModule, AutomationActionType, AutomationRecipientStrategy, AutomationTriggerType,
  ConditionOperator,
} from '../../../modules/native-crm/queries/automation-rules.queries';
import { useCustomModulesQuery } from '../../../modules/native-crm/queries/custom-modules.queries';
import { RuleForm } from './LegacyRuleModal';

export const BUILT_IN_MODULES: { key: AutomationModule; label: string }[] = [
  { key: 'lead',       label: 'Leads' },
  { key: 'deal',       label: 'Deals' },
  { key: 'task',       label: 'Tasks' },
  { key: 'ticket',     label: 'Tickets' },
  { key: 'quotation',  label: 'Quotations' },
  { key: 'workorder',  label: 'Work Orders' },
  { key: 'contract',   label: 'Contracts' },
  { key: 'invoice',    label: 'Invoices' },
];

/** For a 'status_changed' trigger only — Custom Modules only show up here
 * once a tenant has designated a pipeline field for them
 * (CustomModuleBuilderPage), since no pipeline field means no stage to
 * trigger a rule off. Do NOT reuse this for anything that doesn't require a
 * stage (record_created triggers, create_linked_record targets, label
 * lookups) — those apply equally to every custom module, pipeline or not. */
export function useStageCapableModules(): { key: AutomationModule; label: string }[] {
  const { data: customModules = [] } = useCustomModulesQuery();
  const withPipeline = customModules.filter((m) => m.pipelineFieldKey);
  return [
    ...BUILT_IN_MODULES,
    ...withPipeline.map((m) => ({ key: `custom:${m.slug}` as AutomationModule, label: m.name })),
  ];
}

/** Every module a tenant could plausibly reference — built-ins plus ALL
 * custom modules, regardless of whether they have a pipeline field. Used
 * anywhere a stage isn't required: record_created triggers, the
 * create_linked_record target picker, the rules list's module filter, and
 * friendly-label lookups (so a module never silently falls back to showing
 * its raw custom:<slug> key just because it has no pipeline configured). */
export function useEveryModule(): { key: AutomationModule; label: string }[] {
  const { data: customModules = [] } = useCustomModulesQuery();
  return [
    ...BUILT_IN_MODULES,
    ...customModules.map((m) => ({ key: `custom:${m.slug}` as AutomationModule, label: m.name })),
  ];
}

const RECIPIENT_LABELS: Record<AutomationRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
};

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '=',             label: 'is' },
  { value: '!=',            label: 'is not' },
  { value: '>',             label: '>' },
  { value: '<',             label: '<' },
  { value: '>=',            label: '>=' },
  { value: '<=',            label: '<=' },
  { value: 'contains',      label: 'contains' },
  { value: 'startsWith',    label: 'starts with' },
  { value: 'endsWith',      label: 'ends with' },
  { value: 'is_empty',      label: 'is empty' },
  { value: 'is_not_empty',  label: 'is not empty' },
  { value: 'between',       label: 'between' },
  { value: 'in_list',       label: 'in list (comma-separated)' },
  { value: 'not_in_list',   label: 'not in list (comma-separated)' },
];

// ── Visual automation canvas (Phase 3) ────────────────────────────────────────
// A rule renders as one draggable card holding a Trigger chip and an Action
// chip, connected by a short fixed arrow INSIDE the card (their relative
// offset never changes, so this connector needs no recomputation — see the
// plan's "3b — intra-rule connector"). Cross-rule chain connectors ("3c",
// the actual architecture-map payoff) are real SVG lines computed from each
// card's live canvas position, redrawn as either end is dragged.

const CANVAS_CARD_W = 260;
const CANVAS_CARD_H = 108;
const CANVAS_GRID_COLS = 4;
const CANVAS_GRID_GAP = 36;
const CANVAS_GRID_PAD = 32;

function describeTriggerShort(rule: AutomationRule): string {
  if (rule.triggerType === 'record_created') return 'New record created';
  if (rule.triggerType === 'record_deleted') return 'Record deleted';
  if (rule.triggerType === 'record_updated') {
    return rule.triggerStage ? `${rule.triggerField} → ${rule.triggerStage}` : `${rule.triggerField} changes`;
  }
  if (rule.triggerType === 'scheduled') {
    const n = rule.scheduleFilter?.length ?? 0;
    return `Scheduled${n > 0 ? ` (${n} condition${n > 1 ? 's' : ''})` : ''}`;
  }
  return `Status → ${rule.triggerStage}`;
}

function describeActionShort(rule: AutomationRule, moduleLabel: (m: AutomationModule) => string): string {
  if (rule.actionType === 'create_linked_record') return `Create ${moduleLabel(rule.targetModule as AutomationModule)} record`;
  if (rule.actionType === 'assign_staff') return 'Assign Staff (Round Robin)';
  if (rule.actionType === 'assign_team') return 'Assign Team';
  if (rule.actionType === 'send_sms') return 'Send SMS';
  if (rule.actionType === 'send_whatsapp') return 'Send WhatsApp';
  return 'Send Email';
}

/** A one-line, at-a-glance answer to "what data actually flows into the
 * target record" — reads straight off the rule's own fieldMappings (already
 * in memory, no extra fetch) rather than making someone open the edit form
 * just to see what's mapped. Raw field keys, not human labels — resolving
 * labels would need a per-card field-catalog call this canvas deliberately
 * avoids; the full form (one click away) already shows friendly labels. */
function describeMappingPreview(rule: AutomationRule): string | null {
  const mappings = rule.fieldMappings;
  if (!mappings || mappings.length === 0) return null;
  const first = mappings[0];
  const firstText = first.sourceType === 'static'
    ? `"${first.staticValue}" → ${first.targetField}`
    : `${first.sourceField} → ${first.targetField}`;
  return mappings.length > 1 ? `${firstText} +${mappings.length - 1} more` : firstText;
}

function actionAccentClasses(rule: AutomationRule): { bg: string; text: string; border: string } {
  if (rule.actionType === 'create_linked_record') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (rule.actionType === 'assign_staff' || rule.actionType === 'assign_team') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  if (rule.actionType === 'send_sms') return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
  if (rule.actionType === 'send_whatsapp') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
}

/** A rule chains into another when its create_linked_record action targets a
 * module that some OTHER rule itself triggers on — e.g. "Site Visit
 * completed" (module A) creates a record in module B, and module B has its
 * own rule watching for that creation. This is what turns the flat rule list
 * into a real architecture diagram: the connector is always DERIVED from
 * existing rule configuration, never a relationship a user draws by hand
 * (the engine is one-trigger-plus-one-action per rule, not an arbitrary
 * graph — see the plan's explicit "deliberately not attempted"). */
function computeChains(rules: AutomationRule[]): { from: string; to: string }[] {
  const chains: { from: string; to: string }[] = [];
  for (const r of rules) {
    if (r.actionType !== 'create_linked_record' || !r.targetModule) continue;
    for (const other of rules) {
      if (other._id === r._id || other.module !== r.targetModule) continue;
      chains.push({ from: r._id, to: other._id });
    }
  }
  return chains;
}

/** Drag-and-drop payload for a palette item — deliberately tiny (just which
 * picker to pre-fill), not a full node definition, since the actual rule
 * shape is still one-trigger-plus-one-action (see computeChains' comment on
 * why connectors stay derived, not user-drawn, in this engine). */
interface PaletteDrag { kind: 'trigger' | 'action'; value: AutomationTriggerType | AutomationActionType; }
const PALETTE_MIME = 'application/x-automation-node';

const TRIGGER_PALETTE: { value: AutomationTriggerType; label: string; hint: string }[] = [
  { value: 'status_changed', label: 'Status Changed', hint: 'When status reaches a stage' },
  { value: 'record_created', label: 'New Record',      hint: 'When a record is created' },
  { value: 'record_updated', label: 'Field Updated',    hint: 'When one field changes' },
  { value: 'record_deleted', label: 'Record Deleted',   hint: 'When a record is removed' },
  { value: 'scheduled',      label: 'Scheduled',        hint: 'Checked on a recurring timer' },
];
const ACTION_PALETTE: { value: AutomationActionType; label: string; hint: string }[] = [
  { value: 'send_email',           label: 'Send Email',          hint: 'Email via a template' },
  { value: 'send_sms',             label: 'Send SMS',             hint: 'SMS via a template' },
  { value: 'send_whatsapp',        label: 'Send WhatsApp',        hint: 'WhatsApp via a template' },
  { value: 'create_linked_record', label: 'Create Linked Record', hint: 'Create a record in another module' },
  { value: 'assign_staff',         label: 'Assign Staff',         hint: 'Round-robin rotate an active staff member onto the record' },
  { value: 'assign_team',          label: 'Assign Team',          hint: 'Set a fixed target team on the record' },
];

function PaletteItem({ kind, value, label, hint, accentClass }: {
  kind: 'trigger' | 'action'; value: AutomationTriggerType | AutomationActionType;
  label: string; hint: string; accentClass: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        const payload: PaletteDrag = { kind, value };
        e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing bg-surface hover:shadow-sm transition-shadow ${accentClass}`}
      title="Drag onto the canvas to start a new rule with this preset"
    >
      <p className="text-[11.5px] font-semibold text-text-primary">{label}</p>
      <p className="text-[10px] text-text-muted leading-tight">{hint}</p>
    </div>
  );
}

function RuleCanvasView({ rules, moduleLabel, onEdit }: {
  rules: AutomationRule[];
  moduleLabel: (m: AutomationModule) => string;
  onEdit: (rule: AutomationRule) => void;
}) {
  const updateMut = useUpdateAutomationRule();
  const deleteMut = useDeleteAutomationRule();
  const canvasInnerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [createAt, setCreateAt] = useState<{ x: number; y: number } | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [hoveredChain, setHoveredChain] = useState<number | null>(null);
  const [paletteDrop, setPaletteDrop] = useState<PaletteDrag | null>(null);

  // Grid slots are only handed out to rules that have never been dragged
  // (no saved canvasPosition) — assigned by their order among JUST that
  // subset, so a manually positioned card never gets bumped by one nearby.
  const autoPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    let i = 0;
    for (const r of rules) {
      if (r.canvasPosition) continue;
      map.set(r._id, {
        x: CANVAS_GRID_PAD + (i % CANVAS_GRID_COLS) * (CANVAS_CARD_W + CANVAS_GRID_GAP),
        y: CANVAS_GRID_PAD + Math.floor(i / CANVAS_GRID_COLS) * (CANVAS_CARD_H + CANVAS_GRID_GAP),
      });
      i++;
    }
    return map;
  }, [rules]);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const r of rules) {
        next[r._id] = prev[r._id] ?? r.canvasPosition ?? autoPositions.get(r._id) ?? { x: CANVAS_GRID_PAD, y: CANVAS_GRID_PAD };
      }
      return next;
    });
  }, [rules, autoPositions]);

  const posOf = (id: string) => positions[id] ?? { x: CANVAS_GRID_PAD, y: CANVAS_GRID_PAD };
  const chains = useMemo(() => computeChains(rules), [rules]);

  const canvasW = Math.max(1200, ...rules.map((r) => posOf(r._id).x + CANVAS_CARD_W + CANVAS_GRID_PAD));
  const canvasH = Math.max(700, ...rules.map((r) => posOf(r._id).y + CANVAS_CARD_H + CANVAS_GRID_PAD));

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasInnerRef.current) return; // a card's own click bubbles here too — ignore it
    const rect = canvasInnerRef.current!.getBoundingClientRect();
    setCreateAt({
      x: Math.max(0, Math.round(e.clientX - rect.left - CANVAS_CARD_W / 2)),
      y: Math.max(0, Math.round(e.clientY - rect.top - CANVAS_CARD_H / 2)),
    });
    setCreating(true);
  };

  const handlePaletteDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    if (!raw) return;
    const drag = JSON.parse(raw) as PaletteDrag;
    const rect = canvasInnerRef.current!.getBoundingClientRect();
    setCreateAt({
      x: Math.max(0, Math.round(e.clientX - rect.left - CANVAS_CARD_W / 2)),
      y: Math.max(0, Math.round(e.clientY - rect.top - CANVAS_CARD_H / 2)),
    });
    setPaletteDrop(drag);
    setCreating(true);
  };

  return (
    <div className="flex gap-4 items-start">
      <div className="w-[168px] shrink-0 space-y-3">
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5 px-0.5">Triggers</p>
          <div className="space-y-1.5">
            {TRIGGER_PALETTE.map((t) => (
              <PaletteItem key={t.value} kind="trigger" value={t.value} label={t.label} hint={t.hint}
                accentClass="border-amber-200 hover:border-amber-300" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5 px-0.5">Actions</p>
          <div className="space-y-1.5">
            {ACTION_PALETTE.map((a) => (
              <PaletteItem key={a.value} kind="action" value={a.value} label={a.label} hint={a.hint}
                accentClass="border-border hover:border-ryze-300 dark:border-ryze-700" />
            ))}
          </div>
        </div>
        <p className="text-[10.5px] text-text-muted px-0.5 leading-relaxed">Drag one onto the canvas to start a new rule pre-set to that trigger or action.</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted mb-2.5">
          Click empty canvas space (or drop a node from the left) to add a rule · drag a card to reposition it · click a card to edit it.
          Dashed arrows show rules that chain into each other (one rule's action creates a record in a module another rule watches).
        </p>
        <div
          className="relative border border-border rounded-xl bg-background overflow-auto"
          style={{
            height: '70vh',
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <div ref={canvasInnerRef} onClick={handleBackgroundClick}
            onDragOver={(e) => e.preventDefault()} onDrop={handlePaletteDrop}
            style={{ position: 'relative', width: canvasW, height: canvasH }}>
          <svg width={canvasW} height={canvasH} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }}>
            <defs>
              <marker id="automation-chain-arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
              </marker>
            </defs>
            {chains.map(({ from, to }, i) => {
              const a = posOf(from);
              const b = posOf(to);
              const x1 = a.x + CANVAS_CARD_W, y1 = a.y + CANVAS_CARD_H / 2;
              const x2 = b.x, y2 = b.y + CANVAS_CARD_H / 2;
              const midX = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 4"
                    opacity={hoveredChain === i ? 1 : 0.65} markerEnd="url(#automation-chain-arrow)" />
                  {/* Wide, invisible hit-area on top of the thin visible line — a
                     2px stroke is nearly impossible to hover precisely, so this
                     overrides the SVG's own pointer-events:none just for itself
                     to make the "what data flows here" popover discoverable. */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredChain(i)} onMouseLeave={() => setHoveredChain((h) => (h === i ? null : h))} />
                </g>
              );
            })}
          </svg>

          {hoveredChain !== null && chains[hoveredChain] && (() => {
            const { from, to } = chains[hoveredChain];
            const sourceRule = rules.find((r) => r._id === from);
            const targetRule = rules.find((r) => r._id === to);
            const a = posOf(from);
            const b = posOf(to);
            const midX = (a.x + CANVAS_CARD_W + b.x) / 2;
            const midY = (a.y + b.y) / 2 + CANVAS_CARD_H / 2;
            return (
              <div
                className="absolute z-20 bg-surface border border-border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
                style={{ left: midX, top: midY, transform: 'translate(-50%, -110%)', minWidth: 180, maxWidth: 260 }}
              >
                <p className="font-semibold text-text-primary mb-1 truncate">{sourceRule?.name} → {targetRule?.name}</p>
                {sourceRule?.fieldMappings && sourceRule.fieldMappings.length > 0 ? (
                  <ul className="space-y-0.5">
                    {sourceRule.fieldMappings.map((m, mi) => (
                      <li key={mi} className="text-text-muted truncate">
                        {m.sourceType === 'static' ? `"${m.staticValue}"` : m.sourceField} <span className="text-text-muted">→</span> <span className="text-text-primary">{m.targetField}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted">No field mappings on this rule.</p>
                )}
              </div>
            );
          })()}

          {rules.map((rule) => {
            const pos = posOf(rule._id);
            const accent = actionAccentClasses(rule);
            return (
              <Rnd
                key={rule._id}
                size={{ width: CANVAS_CARD_W, height: CANVAS_CARD_H }}
                position={{ x: pos.x, y: pos.y }}
                enableResizing={false}
                onDragStart={(_, d) => { dragStart.current = { x: d.x, y: d.y }; }}
                onDrag={(_, d) => setPositions((prev) => ({ ...prev, [rule._id]: { x: d.x, y: d.y } }))}
                onDragStop={(_, d) => {
                  setPositions((prev) => ({ ...prev, [rule._id]: { x: d.x, y: d.y } }));
                  const start = dragStart.current;
                  const moved = start ? Math.hypot(d.x - start.x, d.y - start.y) : 0;
                  if (moved < 4) onEdit(rule);
                  else updateMut.mutate({ id: rule._id, data: { canvasPosition: { x: d.x, y: d.y } } });
                }}
                style={{ zIndex: 1 }}
              >
                <div className={`h-full w-full bg-surface rounded-xl border shadow-sm flex flex-col cursor-grab active:cursor-grabbing select-none ${rule.enabled ? 'border-border' : 'border-border opacity-50'}`}>
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border shrink-0">
                    <p className="text-xs font-semibold text-text-primary truncate min-w-0">{rule.name}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(rule); }}
                        className="p-1 text-text-muted hover:text-ryze-600 dark:text-ryze-400 dark:hover:text-ryze-300" title="Edit rule">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule._id); }}
                        className="p-1 text-text-muted hover:text-red-500" title="Delete rule">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-1 px-2.5 py-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="flex-1 min-w-0 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide truncate">{moduleLabel(rule.module)}</p>
                        <p className="text-[11px] text-amber-800 truncate">{describeTriggerShort(rule)}</p>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <div className={`flex-1 min-w-0 rounded-lg ${accent.bg} border ${accent.border} px-2 py-1.5`}>
                        <p className={`text-[9px] font-bold uppercase tracking-wide truncate ${accent.text}`}>Action</p>
                        <p className={`text-[11px] truncate ${accent.text}`}>{describeActionShort(rule, moduleLabel)}</p>
                      </div>
                    </div>
                    {describeMappingPreview(rule) && (
                      <p className="text-[10px] text-text-muted truncate px-1" title={describeMappingPreview(rule) ?? undefined}>
                        {describeMappingPreview(rule)}
                      </p>
                    )}
                  </div>
                </div>
              </Rnd>
            );
          })}
        </div>
      </div>
      </div>

      {creating && (
        <RuleForm
          onClose={() => { setCreating(false); setPaletteDrop(null); }}
          initialCanvasPosition={createAt}
          initialTriggerType={paletteDrop?.kind === 'trigger' ? paletteDrop.value as AutomationTriggerType : undefined}
          initialActionType={paletteDrop?.kind === 'action' ? paletteDrop.value as AutomationActionType : undefined}
        />
      )}
    </div>
  );
}

export default function AutomationRulesPage() {
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState<AutomationModule | ''>('');
  const [view, setView] = useState<'list' | 'canvas'>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const { data: rules = [], isLoading } = useAutomationRulesQuery(moduleFilter || undefined);
  const updateMut = useUpdateAutomationRule();
  const deleteMut = useDeleteAutomationRule();
  const MODULES = useEveryModule();

  const moduleLabel = (m: AutomationModule) => MODULES.find((x) => x.key === m)?.label ?? m;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <BoltIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">Automations</h1>
            <p className="text-xs text-text-muted">When a record is created or its status changes, send an email/SMS or create a linked record automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg shrink-0">
          <button
            onClick={() => setView('list')}
            title="List view"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'list' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ListBulletIcon className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView('canvas')}
            title="Canvas view — see how rules chain together"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'canvas' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Squares2X2Icon className="h-3.5 w-3.5" /> Canvas
          </button>
        </div>
        <button
          onClick={() => navigate('/native-crm/settings/automation-flows')}
          title="Advanced Mode — branching, delays, approvals, sub-flows"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <ShareIcon className="h-3.5 w-3.5" /> Advanced Mode
        </button>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New Rule
        </button>
      </div>

      <div className="px-6 py-3 border-b border-border bg-surface flex items-center gap-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setModuleFilter('')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            moduleFilter === '' ? 'bg-ryze-600/10 text-ryze-700 dark:text-ryze-400' : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          }`}
        >
          All
        </button>
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setModuleFilter(m.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
              moduleFilter === m.key ? 'bg-ryze-600/10 text-ryze-700 dark:text-ryze-400' : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className={view === 'canvas' ? '' : 'max-w-4xl mx-auto'}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-ryze-500 border-t-transparent rounded-full" />
            </div>
          ) : rules.length === 0 ? (
            <div className="bg-surface rounded-xl border border-dashed border-border p-10 text-center">
              <BoltIcon className="h-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">No automation rules yet{moduleFilter ? ` for ${moduleLabel(moduleFilter)}` : ''}.</p>
            </div>
          ) : view === 'canvas' ? (
            <RuleCanvasView rules={rules} moduleLabel={moduleLabel} onEdit={setEditingRule} />
          ) : (
            <div className="bg-surface rounded-xl border border-border shadow-sm divide-y divide-border">
              {rules.map((rule) => (
                <div key={rule._id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => updateMut.mutate({ id: rule._id, data: { enabled: !rule.enabled } })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      rule.enabled ? 'bg-ryze-600' : 'bg-black/[0.06] dark:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-surface shadow transform transition-transform ${
                      rule.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{rule.name}</p>
                    <p className="text-xs text-text-muted">
                      {moduleLabel(rule.module)} ·{' '}
                      {rule.triggerType === 'record_created' ? 'on new record'
                        : rule.triggerType === 'record_deleted' ? 'on delete'
                        : rule.triggerType === 'record_updated'
                          ? <>when <span className="font-medium">{rule.triggerField}</span> {rule.triggerStage ? <>→ <span className="font-medium">{rule.triggerStage}</span></> : 'changes'}</>
                        : rule.triggerType === 'scheduled'
                          ? <>on a schedule{(rule.scheduleFilter?.length ?? 0) > 0 ? ` (${rule.scheduleFilter!.length} condition${rule.scheduleFilter!.length > 1 ? 's' : ''})` : ''}</>
                        : <>when status → <span className="font-medium">{rule.triggerStage}</span></>}
                      {' '}·{' '}
                      {rule.actionType === 'create_linked_record'
                        ? <>Create <span className="font-medium">{moduleLabel(rule.targetModule as AutomationModule)}</span> record</>
                        : rule.actionType === 'assign_staff' || rule.actionType === 'assign_team'
                        ? <>{rule.actionType === 'assign_staff' ? 'Assign Staff (Round Robin)' : 'Assign Team'}</>
                        : <>{rule.actionType === 'send_email' ? 'Email' : rule.actionType === 'send_whatsapp' ? 'WhatsApp' : 'SMS'} · {RECIPIENT_LABELS[rule.recipientStrategy ?? 'record_contact']}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 text-text-muted hover:text-ryze-600 dark:text-ryze-400 dark:hover:text-ryze-300 shrink-0"
                    title="Edit rule"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule._id); }}
                    className="p-1.5 text-text-muted hover:text-red-500 shrink-0"
                    title="Delete rule"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {formOpen && <RuleForm onClose={() => setFormOpen(false)} />}
      {editingRule && <RuleForm rule={editingRule} onClose={() => setEditingRule(null)} />}
    </div>
  );
}
