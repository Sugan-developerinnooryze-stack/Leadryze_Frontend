import { useRef, useState, useEffect } from 'react';
import { TrashIcon, PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ITableColumn } from '../queries/custom-modules.queries';
import { previewFormula } from './formulaEval';

function labelToKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
}

/* ── Per-column formula editor: key chips + operator buttons + live preview ── */

const OPERATORS: [string, string][] = [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['(', '('], [')', ')'], ['%', '%']];

function ColumnFormulaBuilder({ formula, availableKeys, onChange }: {
  formula: string;
  availableKeys: string[];
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ valid: boolean; result: string }>({ valid: true, result: '' });

  useEffect(() => {
    // CSP-safe parser — the app's Content-Security-Policy blocks new Function/eval
    setPreview(previewFormula(formula));
  }, [formula]);

  const insertAtCursor = (text: string) => {
    const el = inputRef.current;
    if (!el) { onChange((formula ?? '') + text); return; }
    const s = el.selectionStart ?? (formula ?? '').length;
    const e = el.selectionEnd ?? (formula ?? '').length;
    const next = (formula ?? '').slice(0, s) + text + (formula ?? '').slice(e);
    onChange(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); }, 0);
  };

  return (
    <div className="space-y-2 mt-1.5">
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Columns</span>
        {availableKeys.length === 0
          ? <span className="text-[10px] text-gray-400 italic">Add other columns first</span>
          : availableKeys.map((k) => (
              <button key={k} type="button" onClick={() => insertAtCursor(`{${k}}`)}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                {k}
              </button>
            ))}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {OPERATORS.map(([label, char]) => (
          <button key={label} type="button" onClick={() => insertAtCursor(char)}
            className="w-6 h-6 rounded-md border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            {label}
          </button>
        ))}
      </div>
      <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        formula && !preview.valid ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/40'
      }`}>
        <span className="text-xs font-bold text-emerald-600 shrink-0 select-none">fx</span>
        <input
          ref={inputRef}
          type="text"
          value={formula ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="{qty} * {price}"
          className="flex-1 min-w-0 bg-transparent font-mono text-xs focus:outline-none text-gray-700"
        />
        {formula && (
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
            preview.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>
            {preview.valid ? `= ${preview.result}` : '⚠ error'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Columns list editor ──────────────────────────────────────────────────── */

interface TableColumnEditorProps {
  columns: ITableColumn[];
  onChange: (cols: ITableColumn[]) => void;
}

export default function TableColumnEditor({ columns, onChange }: TableColumnEditorProps) {
  const cols = columns ?? [];

  // Tracks which columns had their Key box hand-edited by the user (by column
  // position). Only those stop auto-following the label — everything else
  // keeps the key in sync with the label as it's typed, so a column never
  // silently freezes on whatever the first keystroke happened to produce.
  const [manualKey, setManualKey] = useState<boolean[]>([]);
  const dragSrc = useRef<number | null>(null);

  const addCol = () => {
    onChange([...cols, { key: '', label: '', type: 'text' }]);
    setManualKey((prev) => [...prev, false]);
  };
  const deleteCol = (i: number) => {
    onChange(cols.filter((_, j) => j !== i));
    setManualKey((prev) => prev.filter((_, j) => j !== i));
  };
  const patchCol = (i: number, patch: Partial<ITableColumn>) =>
    onChange(cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  // Move a column (and its manual-key flag) from one position to another —
  // used by the drag handle below. Keeps manualKey aligned with its column.
  const moveCol = (from: number, to: number) => {
    if (from === to) return;
    const nextCols = [...cols];
    const [movedCol] = nextCols.splice(from, 1);
    nextCols.splice(to, 0, movedCol);
    onChange(nextCols);

    setManualKey((prev) => {
      const next = [...prev];
      const [movedFlag] = next.splice(from, 1);
      next.splice(to, 0, movedFlag ?? false);
      return next;
    });
  };

  const setLabel = (i: number, label: string) => {
    const patch: Partial<ITableColumn> = { label };
    if (!manualKey[i]) patch.key = labelToKey(label);
    patchCol(i, patch);
  };
  const setKeyManually = (i: number, key: string) => {
    setManualKey((prev) => { const next = [...prev]; next[i] = true; return next; });
    patchCol(i, { key });
  };

  // Duplicate-key detection — two columns silently sharing a key means they
  // read/write the exact same cell at runtime, which is the bug this guards.
  const keyCounts = new Map<string, number>();
  cols.forEach((c) => { if (c.key) keyCounts.set(c.key, (keyCounts.get(c.key) ?? 0) + 1); });

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-teal-200 bg-teal-50/30 p-3">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Columns</span>

      {cols.map((col, i) => {
        const otherKeys = cols.filter((c, j) => j !== i && c.key).map((c) => c.key);
        const isDup = !!col.key && (keyCounts.get(col.key) ?? 0) > 1;
        return (
          <div
            key={i}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => {
              if (dragSrc.current === null || dragSrc.current === i) return;
              moveCol(dragSrc.current, i);
              dragSrc.current = i;
            }}
            className={`flex items-start gap-2 bg-white rounded-lg border p-2.5 ${isDup ? 'border-red-300' : 'border-teal-100'}`}
          >
            <span
              draggable
              onDragStart={() => { dragSrc.current = i; }}
              onDragEnd={() => { dragSrc.current = null; }}
              title="Drag to reorder"
              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-base leading-none select-none shrink-0 pt-1.5"
            >
              ⠿
            </span>
            <div className="flex-1 space-y-1.5 min-w-0">
              <input
                value={col.label}
                onChange={(e) => setLabel(i, e.target.value)}
                placeholder="Column label (e.g. Price)"
                className="w-full border-b border-gray-200 text-sm px-1 py-0.5 bg-transparent focus:outline-none focus:border-teal-400 text-gray-700"
              />

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 shrink-0">Key</span>
                <input
                  value={col.key}
                  onChange={(e) => setKeyManually(i, e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="auto"
                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded border w-28 focus:outline-none ${
                    isDup ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-600 focus:ring-1 focus:ring-teal-400'
                  }`}
                />
                {isDup && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500">
                    <ExclamationTriangleIcon className="h-3 w-3" /> Duplicate — edit one
                  </span>
                )}
              </div>

              <select
                value={col.type}
                onChange={(e) => patchCol(i, { type: e.target.value as ITableColumn['type'], options: [], formula: '' })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
                <option value="formula">Formula (fx)</option>
              </select>

              {col.type === 'dropdown' && (
                <input
                  value={(col.options ?? []).join(', ')}
                  onChange={(e) => patchCol(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Option A, Option B, Option C"
                  className="w-full border-b border-gray-200 text-xs px-1 py-0.5 bg-transparent focus:outline-none"
                />
              )}

              {col.type === 'formula' && (
                <ColumnFormulaBuilder
                  formula={col.formula ?? ''}
                  availableKeys={otherKeys}
                  onChange={(v) => patchCol(i, { formula: v })}
                />
              )}
            </div>
            <button type="button" onClick={() => deleteCol(i)} className="text-gray-300 hover:text-red-400 shrink-0 p-1">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <button type="button" onClick={addCol}
        className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1.5 font-medium">
        <PlusIcon className="h-3.5 w-3.5" /> Add column
      </button>
      {cols.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">Click "Add column" to define your table structure.</p>
      )}
    </div>
  );
}
