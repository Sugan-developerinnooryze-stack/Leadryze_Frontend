import { useMemo, useState } from 'react';
import { LinkIcon, UserIcon, ClockIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CrmRecord } from './types/crm.types';
import { statusColor } from './crm.colors';

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};

const DATE_FIELDS = ['dueDate', 'date', 'startDate'] as const;

function cardDate(r: CrmRecord): string | null {
  for (const field of DATE_FIELDS) {
    const raw = r[field];
    if (!raw) continue;
    const d = new Date(raw as string);
    if (!isNaN(d.getTime())) return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  return null;
}

/** Shared between the real sortable card and the floating DragOverlay
 * clone — same pattern as LeadsPage.tsx/DealsPage.tsx's own card bodies. */
function KanbanCardBody({
  record, iconColor, displayName, onEditClick,
}: {
  record: CrmRecord;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
  onEditClick?: (r: CrmRecord) => void;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold text-white mt-0.5"
          style={{ backgroundColor: iconColor }}
        >
          {displayName(record).slice(0, 2).toUpperCase()}
        </div>
        <p className="text-sm font-medium text-text-primary leading-snug flex-1 min-w-0">{displayName(record)}</p>
        {onEditClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditClick(record); }}
            title="Edit"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 -m-1 shrink-0 rounded-md text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-all duration-150"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {typeof record.priority === 'string' && record.priority && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_COLOR[record.priority] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
            {record.priority}
          </span>
        )}
        {typeof record.contactName === 'string' && record.contactName && (
          <span className="text-[10px] text-text-muted truncate">{record.contactName}</span>
        )}
        {typeof record.assignedTo === 'string' && record.assignedTo && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted truncate">
            <UserIcon className="h-2.5 w-2.5" /> {record.assignedTo}
          </span>
        )}
      </div>
      {typeof record.relatedLabel === 'string' && record.relatedLabel && (
        <p className="inline-flex items-center gap-1 text-[10px] text-ryze-500 truncate mt-1">
          <LinkIcon className="h-2.5 w-2.5 shrink-0" /> {record.relatedLabel}
        </p>
      )}
      {cardDate(record) && (
        <p className="inline-flex items-center gap-1 text-[10px] text-text-muted mt-1">
          <ClockIcon className="h-2.5 w-2.5 shrink-0" /> {cardDate(record)}
        </p>
      )}
    </>
  );
}

/** Real, in-column card — dnd-kit sortable. Same pointer-tracked-drag
 * reasoning as LeadsPage.tsx's LeadCard (native HTML5 DnD can't produce
 * the Trello-style live reflow, only coarse dragenter/dragover events). */
function KanbanCard({
  record, borderColor, iconColor, displayName, onClick, onEditClick,
}: {
  record: CrmRecord;
  borderColor?: string;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
  onClick: (r: CrmRecord) => void;
  onEditClick: (r: CrmRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: record._id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: borderColor || 'transparent',
    borderLeftWidth: 3,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(record)}
      className={`group relative bg-surface rounded-lg border border-border pl-2.5 pr-2 py-2.5 cursor-grab active:cursor-grabbing select-none touch-none
        ${isDragging ? 'opacity-30' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow duration-200 ease-out'}`}
    >
      <KanbanCardBody record={record} iconColor={iconColor} displayName={displayName} onEditClick={onEditClick} />
    </div>
  );
}

function KanbanCardDragPreview({
  record, borderColor, iconColor, displayName,
}: {
  record: CrmRecord;
  borderColor?: string;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
}) {
  return (
    <div
      style={{ borderLeftColor: borderColor || 'transparent', borderLeftWidth: 3 }}
      className="w-72 bg-surface rounded-lg border border-border pl-2.5 pr-2 py-2.5 shadow-2xl scale-105 rotate-2 cursor-grabbing"
    >
      <KanbanCardBody record={record} iconColor={iconColor} displayName={displayName} />
    </div>
  );
}

function KanbanColumnView({
  status, items, configuredHex, iconColor, displayName, onOpenRecord, onEditClick, collapsed, onToggleCollapse,
}: {
  status: string;
  items: CrmRecord[];
  configuredHex?: string;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
  onOpenRecord: (r: CrmRecord) => void;
  onEditClick: (r: CrmRecord) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  const itemIds = useMemo(() => items.map((r) => r._id), [items]);
  const c = configuredHex ? null : statusColor(status);
  const label = status.replace(/_/g, ' ');

  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onToggleCollapse}
        title={`Expand ${label}`}
        className={`flex-shrink-0 w-10 flex flex-col items-center gap-2.5 py-3 rounded-xl border transition-all duration-200
          ${isOver ? 'border-ryze-400 bg-ryze-600/10 ring-2 ring-ryze-300' : 'border-border bg-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'}`}
      >
        <ChevronRightIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
        <span
          className="text-[11px] font-bold text-text-primary uppercase tracking-wide whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {label}
        </span>
        <span className="text-[10px] font-semibold text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0">
          {items.length}
        </span>
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 flex flex-col animate-column-expand">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${configuredHex ? '' : `${c!.bg} ${c!.text}`}`}
          style={configuredHex ? { backgroundColor: `${configuredHex}20`, color: configuredHex } : undefined}
        >
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted font-medium">{items.length}</span>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`Collapse ${label}`}
            className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 space-y-2 min-h-[80px] border-2 border-dashed transition-colors duration-150
          ${isOver ? 'border-ryze-400 bg-ryze-600/10' : 'border-transparent'}`}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((r) => (
            <KanbanCard
              key={r._id}
              record={r}
              borderColor={configuredHex}
              iconColor={iconColor}
              displayName={displayName}
              onClick={onOpenRecord}
              onEditClick={onEditClick}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="text-xs text-text-muted text-center py-4 select-none">Drop here</div>
        )}
      </div>
    </div>
  );
}

/**
 * dnd-kit sortable board — pointer-tracked drag (not native HTML5 DnD),
 * which is what makes the Trello-style "other cards slide over to open a
 * gap" reflow possible; native DnD only fires coarse dragenter/dragover
 * events. Same pattern as LeadsPage.tsx/DealsPage.tsx's own boards.
 *
 * Column collapse state is intentionally kept local-only (not persisted to
 * localStorage) — this one component is reused across several unrelated
 * modules (Tasks, Tickets, Calls, every Custom Module), and a single
 * shared storage key would leak one board's collapsed columns into
 * another's if their status keys ever happened to match.
 */
export default function KanbanBoard({
  records, statusField, statusOptions, stageColors, iconColor, displayName, onOpenRecord, onStatusChange,
}: {
  records: CrmRecord[];
  statusField: string;
  statusOptions: string[];
  /** Stage key -> hex color, from the tenant's own configured pipeline
   * (Pipeline & Stages settings) — when a column's key has an entry here,
   * its color wins over the generic statusColor() fallback below, so the
   * color a tenant picks in Settings actually shows up on the board. */
  stageColors?: Record<string, string>;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
  onOpenRecord: (r: CrmRecord) => void;
  onStatusChange: (r: CrmRecord, next: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggleCollapse = (status: string) => {
    setCollapsed((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  const recordsById = useMemo(() => new Map(records.map((r) => [r._id, r])), [records]);
  const [boardColumns, setBoardColumns] = useState<Record<string, string[]>>({});
  useMemo(() => {
    const next: Record<string, string[]> = {};
    statusOptions.forEach((status) => {
      next[status] = records.filter((r) => String(r[statusField] ?? '') === status).map((r) => r._id);
    });
    setBoardColumns(next);
    // Recompute whenever the underlying records (or the status list) change
    // — intentionally not memoized against boardColumns itself, only the
    // server-derived inputs, same sync rule as LeadsPage.tsx's useEffect
    // version of this (useMemo here instead, since this component has no
    // separate effect-timing need).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, statusField, statusOptions.join(',')]);

  const [activeRecord, setActiveRecord] = useState<CrmRecord | null>(null);
  const activeBorderColor = activeRecord ? stageColors?.[String(activeRecord[statusField] ?? '')] : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveRecord(recordsById.get(String(event.active.id)) ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setBoardColumns((prev) => {
      const fromKey = Object.keys(prev).find((k) => prev[k].includes(activeId));
      const overKey = overId.startsWith('column:') ? overId.slice(7) : Object.keys(prev).find((k) => prev[k].includes(overId));
      if (!fromKey || !overKey || fromKey === overKey) return prev;

      const fromItems = prev[fromKey].filter((id) => id !== activeId);
      const toItems = [...prev[overKey]];
      const overIndex = toItems.indexOf(overId);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, activeId);

      return { ...prev, [fromKey]: fromItems, [overKey]: toItems };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const record = activeRecord;
    setActiveRecord(null);
    if (!record || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const currentStatus = String(record[statusField] ?? '');

    setBoardColumns((prev) => {
      const fromKey = Object.keys(prev).find((k) => prev[k].includes(activeId));
      if (!fromKey) return prev;
      const overKey = overId.startsWith('column:') ? overId.slice(7) : Object.keys(prev).find((k) => prev[k].includes(overId));
      if (overKey !== fromKey) return prev;
      const oldIndex = prev[fromKey].indexOf(activeId);
      const newIndex = prev[fromKey].indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return { ...prev, [fromKey]: arrayMove(prev[fromKey], oldIndex, newIndex) };
    });

    const finalStatus = Object.keys(boardColumns).find((k) => boardColumns[k].includes(activeId));
    if (finalStatus && finalStatus !== currentStatus) {
      onStatusChange(record, finalStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto h-full items-start">
        {statusOptions.map((status) => (
          <KanbanColumnView
            key={status}
            status={status}
            items={(boardColumns[status] ?? []).map((id) => recordsById.get(id)).filter((r): r is CrmRecord => !!r)}
            configuredHex={stageColors?.[status]}
            iconColor={iconColor}
            displayName={displayName}
            onOpenRecord={onOpenRecord}
            onEditClick={onOpenRecord}
            collapsed={collapsed.includes(status)}
            onToggleCollapse={() => toggleCollapse(status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRecord ? (
          <KanbanCardDragPreview record={activeRecord} borderColor={activeBorderColor} iconColor={iconColor} displayName={displayName} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
