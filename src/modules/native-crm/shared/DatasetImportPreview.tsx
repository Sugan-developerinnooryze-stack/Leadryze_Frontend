import { useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon, ArrowPathIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { detectHeaderRow, buildRowsFromHeaderIndex, MAX_HEADER_SCAN_ROWS } from './detectHeaderRow';
import {
  analyzeDatasetColumns, useUploadImageZip, usePreviewImageMatch,
  type DatasetColumn, type SemanticRole, type DatasetSummary, type ImageMatchPreview,
} from '../queries/datasets.queries';

const ROLE_OPTIONS: Array<{ value: SemanticRole | ''; label: string }> = [
  { value: '', label: 'Unmapped (still searchable)' },
  { value: 'name', label: 'Name / Title' },
  { value: 'category', label: 'Category' },
  { value: 'price', label: 'Price' },
  { value: 'location', label: 'Location' },
  { value: 'date', label: 'Date' },
  { value: 'description', label: 'Description' },
  { value: 'identifier', label: 'Identifier / Code' },
  { value: 'image', label: 'Product Image (filename)' },
];

// Mirrors dataset-schema.service.ts's own 0.6 confidence threshold — a
// column below this is flagged in the preview, exactly matching what the
// backend itself would leave unmapped, not a separate frontend guess.
const CONFIDENCE_THRESHOLD = 0.6;

interface Props {
  fileName: string;
  fileType: 'excel' | 'csv' | 'json';
  /** SheetJS array-of-arrays, excel/csv only — same shape CatalogImportPreview uses. */
  aoa?: unknown[][];
  /** Already-parsed rows, JSON only (no header-row concept to detect). */
  jsonRows?: Record<string, unknown>[];
  existingDatasets: DatasetSummary[];
  importing?: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    datasetId?: string; name: string; sourceFileName: string; sourceType: 'excel' | 'csv' | 'json';
    columns: DatasetColumn[]; headerRowIndex: number; rows: Record<string, unknown>[]; imageZipRef?: string;
  }) => void;
}

/** The Generic Dataset system's own confirm-before-import step (plan
 * decision #4) — extends CatalogImportPreview's exact "detect, show,
 * nothing imports until confirmed" pattern with a per-column semantic-role
 * picker instead of just a single title-column check, since a dataset's
 * meaningful fields vary entirely by business type. Low-confidence/unmapped
 * columns are visibly flagged but never hidden or excluded — a tenant can
 * always see and correct every column before anything is sent to the
 * backend. */
export default function DatasetImportPreview({ fileName, fileType, aoa, jsonRows, existingDatasets, importing, onCancel, onConfirm }: Props) {
  const [headerRowIndex, setHeaderRowIndex] = useState(() => (aoa ? detectHeaderRow(aoa) : 0));
  const [datasetTarget, setDatasetTarget] = useState<'new' | string>('new');
  const [datasetName, setDatasetName] = useState(() => fileName.replace(/\.[^.]+$/, ''));
  const [columns, setColumns] = useState<DatasetColumn[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [imageZipFile, setImageZipFile] = useState<File | null>(null);
  const [imageZipError, setImageZipError] = useState<string | null>(null);
  const [imageZipRef, setImageZipRef] = useState<string | null>(null);
  const [matchPreview, setMatchPreview] = useState<ImageMatchPreview | null>(null);
  const uploadImageZipMutation = useUploadImageZip();
  const previewImageMatchMutation = usePreviewImageMatch();

  const { headers, rows } = useMemo(() => {
    if (fileType === 'json') {
      const list = jsonRows ?? [];
      const headerSet = new Set<string>();
      list.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
      return { headers: Array.from(headerSet), rows: list };
    }
    return buildRowsFromHeaderIndex(aoa ?? [], headerRowIndex);
  }, [fileType, jsonRows, aoa, headerRowIndex]);

  const scanLimit = aoa ? Math.min(aoa.length, MAX_HEADER_SCAN_ROWS) : 0;
  const previewRows = rows.slice(0, 5);
  const headersKey = headers.join('|');

  useEffect(() => {
    if (headers.length === 0) { setColumns(null); return; }
    let cancelled = false;
    setAnalyzing(true);
    setAnalyzeError(null);
    analyzeDatasetColumns(headers, rows.slice(0, 20))
      .then((cols) => { if (!cancelled) setColumns(cols); })
      .catch(() => { if (!cancelled) setAnalyzeError('Could not analyze columns — you can still import, everything will be stored unmapped.'); })
      .finally(() => { if (!cancelled) setAnalyzing(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headersKey, rows.length]);

  const updateRole = (index: number, role: SemanticRole | '') => {
    setColumns((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], semanticRole: role || undefined, source: 'manual', confidence: role ? 1 : 0 };
      return next;
    });
  };

  const unmappedCount = columns?.filter((c) => !c.semanticRole).length ?? 0;
  const lowConfidenceCount = columns?.filter((c) => c.semanticRole && c.confidence < CONFIDENCE_THRESHOLD && c.source === 'heuristic').length ?? 0;
  const imageColumn = columns?.find((c) => c.semanticRole === 'image');

  const canConfirm = !!columns && rows.length > 0 && (datasetTarget !== 'new' || datasetName.trim().length > 0)
    && !importing && !uploadImageZipMutation.isPending;

  const declaredImageFilenames = useMemo(() => {
    if (!imageColumn) return [];
    return rows
      .map((r) => r[imageColumn.originalName])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }, [rows, imageColumn]);

  const runPreview = (ref: string, filenames: string[]) => {
    if (filenames.length === 0) { setMatchPreview(null); return; }
    previewImageMatchMutation.mutate(
      { imageZipRef: ref, declaredFilenames: filenames },
      { onSuccess: (result) => setMatchPreview(result), onError: () => setMatchPreview(null) },
    );
  };

  const handleImageZipChange = (file: File | null) => {
    setImageZipError(null);
    setMatchPreview(null);
    setImageZipRef(null);
    if (!file) { setImageZipFile(null); return; }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setImageZipError('Please choose a .zip file.');
      setImageZipFile(null);
      return;
    }
    setImageZipFile(file);
    // Uploaded immediately (not deferred to final confirm) so the match
    // preview below has a real, queryable ref right away — the whole point
    // of this preview is catching a filename mismatch BEFORE the tenant
    // commits to a full import, not after.
    uploadImageZipMutation.mutate(file, {
      onSuccess: ({ imageZipRef: ref }) => {
        setImageZipRef(ref);
        runPreview(ref, declaredImageFilenames);
      },
      onError: () => setImageZipError('Could not upload that ZIP — please try again.'),
    });
  };

  // Re-check the match if the tenant remaps which column holds image
  // filenames AFTER already attaching a ZIP — the declared filename list
  // changes, so the previous preview no longer reflects reality.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (imageZipRef) runPreview(imageZipRef, declaredImageFilenames); }, [imageColumn?.originalName]);

  const handleConfirm = () => {
    if (!columns) return;
    onConfirm({
      datasetId: datasetTarget === 'new' ? undefined : datasetTarget,
      name: datasetTarget === 'new' ? datasetName.trim() : existingDatasets.find((d) => d._id === datasetTarget)?.name ?? datasetName.trim(),
      sourceFileName: fileName,
      sourceType: fileType,
      columns,
      headerRowIndex: fileType === 'json' ? 0 : headerRowIndex,
      rows,
      imageZipRef: imageColumn && imageZipRef ? imageZipRef : undefined,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
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
            {/* Dataset target */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Add to</label>
                <select
                  value={datasetTarget}
                  onChange={(e) => setDatasetTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">+ New dataset</option>
                  {existingDatasets.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} (new version)</option>
                  ))}
                </select>
              </div>
              {datasetTarget === 'new' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dataset name</label>
                  <input
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g. Machines, Course Catalog, Price List"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Header row selector (excel/csv only) */}
            {fileType !== 'json' && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600 shrink-0">Header row</label>
                <select
                  value={headerRowIndex}
                  onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: scanLimit }, (_, i) => i).map((i) => (
                    <option key={i} value={i}>Row {i + 1}{aoa && i === detectHeaderRow(aoa) ? ' (detected)' : ''}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">{headers.length} columns · {rows.length} data row(s)</span>
              </div>
            )}

            {/* Mapping confidence summary */}
            {analyzing ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <ArrowPathIcon className="h-4 w-4 animate-spin shrink-0" />
                Analyzing columns…
              </div>
            ) : analyzeError ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                {analyzeError}
              </div>
            ) : columns && unmappedCount + lowConfidenceCount === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                Every column was recognized with high confidence.
              </div>
            ) : columns ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                {unmappedCount + lowConfidenceCount} column(s) below — still imported and fully searchable, just not mapped to a specific field type. Review below or leave as-is.
              </div>
            ) : null}

            {/* Per-column role mapping */}
            {columns && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Column mapping</p>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {columns.map((col, i) => {
                    const flagged = !col.semanticRole || (col.confidence < CONFIDENCE_THRESHOLD && col.source === 'heuristic');
                    return (
                      <div key={col.originalName + i} className="flex items-center gap-3 px-3 py-2">
                        <span className="text-xs text-gray-700 flex-1 min-w-0 truncate" title={col.originalName}>{col.originalName}</span>
                        {col.source === 'heuristic' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${flagged ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {Math.round(col.confidence * 100)}%
                          </span>
                        )}
                        <select
                          value={col.semanticRole ?? ''}
                          onChange={(e) => updateRole(i, e.target.value as SemanticRole | '')}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product images ZIP — only shown once a column is mapped to
                Product Image, since that column's value is what the ZIP's
                filenames are matched against (dataset-image.service.ts's
                explicit-filename-match design, not SKU-inferred). Optional:
                leaving this empty just means no images import this round —
                every other column still imports normally. */}
            {imageColumn && (
              <div className="border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <PhotoIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <p className="text-xs font-semibold text-gray-700">Product Images (.zip)</p>
                  <span className="text-[10px] text-gray-400">optional</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Each image's filename must match a value in the <span className="font-medium text-gray-700">{imageColumn.originalName}</span> column exactly (e.g. a row with <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">FF-BV100.jpg</code> needs a file of that same name in the ZIP — case doesn't matter, subfolders are fine).
                </p>
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={(e) => handleImageZipChange(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
                {imageZipFile && uploadImageZipMutation.isPending && (
                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin shrink-0" /> Uploading {imageZipFile.name}…
                  </p>
                )}
                {imageZipFile && imageZipRef && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" /> {imageZipFile.name} ({Math.round(imageZipFile.size / 1024)} KB)
                  </p>
                )}
                {imageZipError && (
                  <p className="text-xs text-red-600 mt-1.5">{imageZipError}</p>
                )}

                {/* Live match preview — the exact backend matching logic
                    (openImageZipSafely/normalizeImageFilename), not a
                    reimplementation, so it can never disagree with what the
                    real import does. Surfaces a filename mismatch (e.g.
                    Excel says .jpg, the ZIP has .png) right here instead of
                    only after a full import + manual check. */}
                {previewImageMatchMutation.isPending && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin shrink-0" /> Checking filename matches…
                  </p>
                )}
                {matchPreview && !previewImageMatchMutation.isPending && (
                  <div className={`mt-2 rounded-lg px-3 py-2 text-xs border ${
                    matchPreview.matched === matchPreview.declared
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : matchPreview.matched === 0
                      ? 'bg-red-50 border-red-100 text-red-600'
                      : 'bg-amber-50 border-amber-100 text-amber-700'
                  }`}>
                    <p className="font-medium">
                      {matchPreview.declared} image{matchPreview.declared === 1 ? '' : 's'} declared · {matchPreview.matched} matched
                      {matchPreview.missing > 0 ? ` · ${matchPreview.missing} missing` : ''}
                      {matchPreview.ambiguous > 0 ? ` · ${matchPreview.ambiguous} ambiguous` : ''}
                    </p>
                    {matchPreview.missing > 0 && (
                      <p className="mt-1 opacity-80">
                        Not found in the ZIP: <span className="font-mono">{matchPreview.missingFilenames.slice(0, 5).join(', ')}</span>
                        {matchPreview.missingFilenames.length > 5 ? ` +${matchPreview.missingFilenames.length - 5} more` : ''}
                      </p>
                    )}
                    {matchPreview.ambiguous > 0 && (
                      <p className="mt-1 opacity-80">
                        Matches multiple files in the ZIP (rename to disambiguate): <span className="font-mono">{matchPreview.ambiguousFilenames.slice(0, 5).join(', ')}</span>
                        {matchPreview.ambiguousFilenames.length > 5 ? ` +${matchPreview.ambiguousFilenames.length - 5} more` : ''}
                      </p>
                    )}
                    {matchPreview.matched < matchPreview.declared && (
                      <p className="mt-1 opacity-80">Rows without a match still import — they just won't have an image.</p>
                    )}
                  </div>
                )}
              </div>
            )}

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
              onClick={handleConfirm}
              disabled={!canConfirm}
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
