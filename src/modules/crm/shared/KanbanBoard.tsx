import { useState } from 'react';
import { LinkIcon, UserIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { CrmRecord } from './types/crm.types';
import { statusColor } from './crm.colors';

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700',
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

/**
 * Native HTML5 drag-and-drop board — no dnd library in this project, and
 * this codebase already uses plain draggable/onDragStart/onDrop elsewhere
 * (e.g. the print pages' service/part row reordering), so this matches the
 * existing convention rather than introducing a new dependency.
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columns = statusOptions.map((status) => ({
    status,
    items: records.filter((r) => String(r[statusField] ?? '') === status),
  }));

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full items-start">
      {columns.map((col) => {
        const configuredHex = stageColors?.[col.status];
        const c = configuredHex ? null : statusColor(col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.status); }}
            onDragLeave={() => setOverCol((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              const rec = records.find((r) => r._id === id);
              if (rec && String(rec[statusField]) !== col.status) onStatusChange(rec, col.status);
              setDraggingId(null); setOverCol(null);
            }}
            className={`w-72 shrink-0 rounded-xl border transition-colors ${
              overCol === col.status ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${configuredHex ? '' : `${c!.bg} ${c!.text}`}`}
                style={configuredHex ? { backgroundColor: `${configuredHex}20`, color: configuredHex } : undefined}
              >
                {col.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-gray-400 font-medium">{col.items.length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {col.items.map((r) => (
                <div
                  key={r._id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', r._id); setDraggingId(r._id); }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpenRecord(r)}
                  className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                    draggingId === r._id ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: iconColor }}
                    >
                      {displayName(r).slice(0, 2).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-snug">{displayName(r)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {typeof r.priority === 'string' && r.priority && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_COLOR[r.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.priority}
                      </span>
                    )}
                    {typeof r.contactName === 'string' && r.contactName && (
                      <span className="text-[10px] text-gray-400 truncate">{r.contactName}</span>
                    )}
                    {typeof r.assignedTo === 'string' && r.assignedTo && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 truncate">
                        <UserIcon className="h-2.5 w-2.5" /> {r.assignedTo}
                      </span>
                    )}
                  </div>
                  {typeof r.relatedLabel === 'string' && r.relatedLabel && (
                    <p className="inline-flex items-center gap-1 text-[10px] text-blue-500 truncate mt-1">
                      <LinkIcon className="h-2.5 w-2.5 shrink-0" /> {r.relatedLabel}
                    </p>
                  )}
                  {cardDate(r) && (
                    <p className="inline-flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                      <ClockIcon className="h-2.5 w-2.5 shrink-0" /> {cardDate(r)}
                    </p>
                  )}
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="text-xs text-gray-300 text-center py-4 select-none">Drop here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
