import { useMemo, useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { detectHeaderRow, buildRowsFromHeaderIndex, hasLikelyTitleColumn, MAX_HEADER_SCAN_ROWS } from './detectHeaderRow';

interface Props {
  fileName: string;
  /** Raw array-of-arrays sheet content (SheetJS `sheet_to_json(ws, {header:1})`
   * shape) — detection and row-building both happen from this, live, as the
   * user adjusts the header row. */
  aoa: unknown[][];
  onCancel: () => void;
  onConfirm: (rows: Record<string, unknown>[]) => void;
  importing?: boolean;
}

/** Shown after a file is parsed, before anything is sent to the backend —
 * nothing imports until the user explicitly confirms here. Lets a tenant
 * see (and correct) which row was detected as the real header before
 * committing, instead of finding out from a wall of rejected rows. */
export default function CatalogImportPreview({ fileName, aoa, onCancel, onConfirm, importing }: Props) {
  const [headerRowIndex, setHeaderRowIndex] = useState(() => detectHeaderRow(aoa));

  const { headers, rows } = useMemo(() => buildRowsFromHeaderIndex(aoa, headerRowIndex), [aoa, headerRowIndex]);
  const hasTitleColumn = useMemo(() => hasLikelyTitleColumn(headers), [headers]);
  const scanLimit = Math.min(aoa.length, MAX_HEADER_SCAN_ROWS);
  const previewRows = rows.slice(0, 5);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Review before import</h3>
              <p className="text-xs text-gray-400 truncate">{fileName}</p>
            </div>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-4 overflow-y-auto space-y-4">
            {/* Header row selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 shrink-0">Header row</label>
              <select
                value={headerRowIndex}
                onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: scanLimit }, (_, i) => i).map((i) => (
                  <option key={i} value={i}>Row {i + 1}{i === detectHeaderRow(aoa) ? ' (detected)' : ''}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">{headers.length} columns · {rows.length} data row(s)</span>
            </div>

            {/* Title-column confidence */}
            {hasTitleColumn ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                A name/title column was recognized — every row should import successfully.
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                We couldn't identify a name/title column — try a different header row above, or every row will be rejected as "Missing title."
              </div>
            )}

            {/* Column list */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Columns</p>
              <div className="flex flex-wrap gap-1.5">
                {headers.map((h, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">{h}</span>
                ))}
              </div>
            </div>

            {/* Data preview */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Preview ({previewRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'})
              </p>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((r, ri) => (
                      <tr key={ri}>
                        {headers.map((h, ci) => (
                          <td key={ci} className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{String(r[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                    {previewRows.length === 0 && (
                      <tr><td colSpan={headers.length || 1} className="px-3 py-4 text-center text-gray-400">No data rows found below this header row.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(rows)}
              disabled={importing || rows.length === 0}
              className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {importing ? 'Importing…' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
