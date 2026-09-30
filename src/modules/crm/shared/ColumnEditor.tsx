import { useState, useRef } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { FieldConfig } from './types/crm.types';

interface Props {
  allFields:   FieldConfig[];
  visibleKeys: string[];
  onApply:     (keys: string[]) => void;
  onClose:     () => void;
}

export default function ColumnEditor({ allFields, visibleKeys, onApply, onClose }: Props) {
  const [selected,    setSelected]    = useState<string[]>(visibleKeys);
  const [search,      setSearch]      = useState('');
  const [frozenCount, setFrozenCount] = useState(0);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);

  const filtered = allFields.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const remove = (key: string) =>
    setSelected((prev) => prev.filter((k) => k !== key));

  /* ── drag-and-drop reorder ─────────────────────────────────────── */
  const onDragStart = (e: React.DragEvent, idx: number) => {
    dragNode.current = idx;
    setDragFromIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const onDragEnter = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragNode.current;
    if (from === null || from === idx) return;
    // Mutate ref synchronously BEFORE setState so the next dragEnter sees the new position
    dragNode.current = idx;
    setDragFromIdx(idx);
    setDragOverIdx(idx);
    setSelected((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(idx, 0, item);
      return next;
    });
  };

  const onDragEnd = () => {
    setDragFromIdx(null);
    setDragOverIdx(null);
    dragNode.current = null;
  };

  const selectedFields = selected
    .map((k) => allFields.find((f) => f.key === k))
    .filter(Boolean) as FieldConfig[];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold text-text-primary">Choose which columns you see</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body — two panels */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left: available columns */}
            <div className="w-1/2 border-r border-border flex flex-col min-h-0">
              <div className="p-4 border-b border-border shrink-0">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search columns..."
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ryze-500 bg-background text-text-primary"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-2 mb-2">PROPERTIES</p>
                {filtered.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(f.key)}
                      onChange={() => toggle(f.key)}
                      className="h-4 w-4 rounded border-border text-ryze-600 dark:text-ryze-400 focus:ring-ryze-500 cursor-pointer"
                    />
                    <span className="text-sm text-text-primary">{f.label}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-text-muted text-center py-6">No columns match</p>
                )}
              </div>
            </div>

            {/* Right: selected columns (drag-to-reorder) */}
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  SELECTED COLUMNS ({selected.length})
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Frozen columns</span>
                  <select
                    value={frozenCount}
                    onChange={(e) => setFrozenCount(Number(e.target.value))}
                    className="text-xs border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ryze-500 bg-background text-text-primary"
                  >
                    {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {selected.length === 0 && (
                  <p className="text-sm text-text-muted text-center mt-10">No columns selected</p>
                )}
                {selectedFields.map((f, idx) => (
                  <div
                    key={f.key}
                    draggable
                    onDragStart={(e) => onDragStart(e, idx)}
                    onDragEnter={(e) => onDragEnter(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors ${
                      idx < frozenCount
                        ? 'border-ryze-200 dark:border-ryze-800 bg-ryze-600/10/60'
                        : dragFromIdx === idx
                        ? 'border-ryze-300 dark:border-ryze-700 bg-ryze-600/10 opacity-50'
                        : dragOverIdx === idx
                        ? 'border-ryze-400 bg-ryze-600/10'
                        : 'border-border bg-surface hover:bg-background'
                    } cursor-grab active:cursor-grabbing`}
                  >
                    {/* Drag handle */}
                    <svg className="h-4 w-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>

                    {idx < frozenCount && (
                      <span className="text-[9px] font-bold text-ryze-500 uppercase bg-ryze-600/15 px-1.5 py-0.5 rounded shrink-0">
                        frozen
                      </span>
                    )}

                    <span className="text-sm text-text-primary flex-1 truncate">{f.label}</span>

                    <button
                      onClick={() => remove(f.key)}
                      className="p-0.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-text-muted hover:text-text-primary transition-colors shrink-0"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <button
              onClick={() => setSelected([])}
              className="text-sm text-text-muted hover:text-text-primary underline transition-colors"
            >
              Remove all columns
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onApply(selected); onClose(); }}
                className="px-5 py-2 bg-ryze-600 hover:bg-ryze-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
