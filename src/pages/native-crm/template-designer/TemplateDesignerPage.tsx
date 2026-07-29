import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  ArrowLeftIcon, CheckIcon, PlusIcon, TrashIcon,
  StarIcon, DocumentDuplicateIcon, EyeIcon, XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import {
  useCustomTemplatesQuery,
  useCustomTemplateCreate,
  useCustomTemplateUpdate,
  useCustomTemplateDelete,
  useCustomTemplateSetDefault,
  useSeedStarterTemplate,
  useTemplateCatalogQuery,
  useLiveDataQuery,
  previewDraftHtml,
  downloadDraftPdf,
  type LiveData,
} from '../../../modules/native-crm/queries/custom-templates.queries';
import {
  useTemplateAssetsQuery,
  useTemplateAssetUpload,
  useTemplateAssetDelete,
  type TemplateAsset,
} from '../../../modules/native-crm/queries/template-assets.queries';
import { useTemplateAnalysisMutation } from '../../../modules/native-crm/queries/template-analysis.queries';
import { useInvoicesListQuery }   from '../../../modules/native-crm/queries/invoices.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';
import { useContractsListQuery }  from '../../../modules/native-crm/queries/contracts.queries';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';

// ── Types (kept in lockstep with backend custom-template.model.ts) ───────────

type ElemType = 'text' | 'richtext' | 'image' | 'table' | 'totals' | 'divider' | 'box' | 'gridtable';

interface TableColumn { key: string; label: string; width?: number; align?: 'left' | 'center' | 'right'; }
interface TotalsRow   { key: string; label?: string; }

interface DesignElement {
  id:              string;
  type:            ElemType;
  x: number; y: number; w: number; h: number;
  z?:              number;
  content?:        string;
  fontSize?:       number;
  fontFamily?:     string;
  fontWeight?:     'normal' | 'bold';
  fontStyle?:      'normal' | 'italic';
  lineHeight?:     number;
  color?:          string;
  textAlign?:      'left' | 'center' | 'right';
  padding?:        number;
  src?:            string;
  objectFit?:      'contain' | 'cover' | 'fill';
  backgroundColor?: string;
  borderColor?:    string;
  borderWidth?:    number;
  borderRadius?:   number;
  dataset?:        'services' | 'parts';
  columns?:        TableColumn[];
  headerBg?:       string;
  headerColor?:    string;
  altRowBg?:       string;
  showBorders?:    boolean;
  totalsRows?:          TotalsRow[];
  totalsEmphasizeLast?: boolean;
  // gridtable — manually-authored grid (Word/Excel-style); each cell holds
  // sanitized rich HTML (text, lists, inline images all combinable) with
  // {{token}} bindings substituted the same way a plain `text` element's
  // content is.
  gridRows?:        number;
  gridCols?:        number;
  gridCells?:       string[][];
  gridHeaderRow?:   boolean;
  gridColWidths?:   number[];
  gridRowHeights?:  number[];
}

const DOC_TYPES = ['invoice', 'quotation', 'contract', 'workorder'] as const;
type DocType = typeof DOC_TYPES[number];

const MODULE_FOR_DOCTYPE: Record<DocType, string> = {
  invoice: 'invoices', quotation: 'quotations', contract: 'contracts', workorder: 'workorders',
};
const ID_FIELD: Record<DocType, string> = {
  invoice: 'invoiceId', quotation: 'quotationId', contract: 'contractId', workorder: 'workOrderId',
};

const FONT_FAMILIES = ['Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Tahoma','Trebuchet MS'];

const SERVICE_COLUMN_KEYS = ['index','name','description','count','amount','lineTotal'];
const PART_COLUMN_KEYS    = [...SERVICE_COLUMN_KEYS, 'partNumber'];
const COLUMN_KEY_LABELS: Record<string, string> = {
  index: '#', name: 'Name', description: 'Description', count: 'Qty',
  amount: 'Unit Price', lineTotal: 'Line Total', partNumber: 'Part No.',
};

const TOTALS_KEYS = ['servicesSubtotal','partsSubtotal','subtotal','discount','gst','total','paid','balance'];
const TOTALS_KEY_LABELS: Record<string, string> = {
  servicesSubtotal: 'Services', partsSubtotal: 'Parts', subtotal: 'Subtotal',
  discount: 'Discount', gst: 'GST', total: 'TOTAL', paid: 'Paid', balance: 'Balance Due',
};

// A4 canvas dimensions in px (1mm = 3.7795px; 210mm × 297mm)
const CANVAS_W = 794;
const CANVAS_H = 1123;

function uid() { return Math.random().toString(36).slice(2, 9); }

function defaultForType(type: ElemType, variable?: string): Partial<DesignElement> {
  switch (type) {
    case 'text':     return { content: variable ?? 'Text', fontSize: 13, fontWeight: 'normal', fontStyle: 'normal', color: '#111827', textAlign: 'left' };
    case 'richtext': return { content: variable ?? '{{doc.notes}}', fontSize: 11, color: '#4b5563' };
    case 'image':    return { src: variable ?? '{{company.logo}}', objectFit: 'contain' };
    case 'table':    return { dataset: variable?.includes('parts') ? 'parts' : 'services', showBorders: true };
    case 'totals':   return { totalsRows: [{ key: 'subtotal' }, { key: 'discount' }, { key: 'gst' }, { key: 'total' }], totalsEmphasizeLast: true, fontSize: 11 };
    case 'divider':  return { borderColor: '#e5e7eb', borderWidth: 1 };
    case 'box':      return { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 4 };
    // Grid Table is normally created via its own size-picker (createGridTableElement),
    // not this generic path — this is just a safety-net default.
    case 'gridtable': return { gridRows: 2, gridCols: 2, gridCells: [['', ''], ['', '']], gridHeaderRow: false };
  }
}

function defaultSize(type: ElemType): { w: number; h: number } {
  switch (type) {
    case 'text':      return { w: 200, h: 30  };
    case 'richtext':  return { w: 500, h: 80  };
    case 'image':     return { w: 120, h: 60  };
    // A table's real rendered height always depends on actual row count, so
    // this is only ever a rough starting anchor — but 200px left a huge gap
    // of empty box space for the common case of a handful of line items
    // (header + ~1-4 rows only needs ~120px), making the canvas look far
    // more spaced-out than the real PDF. 120px keeps the box editable while
    // matching the typical case much more closely.
    case 'table':     return { w: 754, h: 120 };
    case 'totals':    return { w: 240, h: 110 };
    case 'divider':   return { w: 720, h: 4   };
    case 'box':       return { w: 200, h: 80  };
    case 'gridtable': return { w: 300, h: 100 };
  }
}

/** Builds a gridtable element from a chosen R×C grid — the Word/Excel-style size picker's result. */
function createGridTableElement(rows: number, cols: number): DesignElement {
  return {
    id: uid(), type: 'gridtable',
    x: 40, y: 40, w: Math.min(754, cols * 100), h: rows * 32,
    gridRows: rows, gridCols: cols,
    gridCells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    gridHeaderRow: false,
    fontSize: 11,
  };
}

// Mirrors the backend renderer's FLOW_TYPES (pdf.variable-renderer.ts) —
// 'table' and 'richtext' both get real, content-driven height there, so
// both can trigger the "beside a flow element" overlap warning below.
// 'gridtable' is fixed-height static content, excluded on both sides.
const FLOW_TYPES = new Set<ElemType>(['table', 'richtext']);
// Header/footer are fixed-height repeating bands; table/richtext/gridtable
// stay excluded from them regardless of FLOW_TYPES above (mirrors the
// backend zod refine in custom-template.validation.ts, which restricts all
// three independent of the renderer's pagination scope).
const HEADER_FOOTER_EXCLUDED_TYPES = new Set<ElemType>(['table', 'richtext', 'gridtable']);

// ── Smart alignment guides (Canva/Figma-style snap-to-align) ──────────────────
// While dragging, checks the moving element's left/center/right and
// top/center/bottom edges against every other element's matching edges plus
// the canvas edges/center. Within SNAP_PX, returns the exact aligned
// position and which guide line to draw — same idea as Canva's pink snap
// lines, kept intentionally simple (no equal-gap/distribution guides).
const SNAP_PX = 6;

function computeSnap(
  dragging: { x: number; y: number; w: number; h: number },
  others: DesignElement[],
  canvasW: number,
  canvasH: number,
): { x: number; y: number; vLine: number | null; hLine: number | null } {
  const left = dragging.x, right = dragging.x + dragging.w, cx = dragging.x + dragging.w / 2;
  const top  = dragging.y, bottom = dragging.y + dragging.h, cy = dragging.y + dragging.h / 2;

  const xTargets = [0, canvasW / 2, canvasW, ...others.flatMap(o => [o.x, o.x + o.w, o.x + o.w / 2])];
  const yTargets = [0, canvasH / 2, canvasH, ...others.flatMap(o => [o.y, o.y + o.h, o.y + o.h / 2])];

  let x = dragging.x, vLine: number | null = null;
  for (const t of xTargets) {
    if (Math.abs(left - t)  <= SNAP_PX) { x = t;              vLine = t; break; }
    if (Math.abs(cx - t)    <= SNAP_PX) { x = t - dragging.w / 2; vLine = t; break; }
    if (Math.abs(right - t) <= SNAP_PX) { x = t - dragging.w; vLine = t; break; }
  }
  let y = dragging.y, hLine: number | null = null;
  for (const t of yTargets) {
    if (Math.abs(top - t)    <= SNAP_PX) { y = t;               hLine = t; break; }
    if (Math.abs(cy - t)     <= SNAP_PX) { y = t - dragging.h / 2; hLine = t; break; }
    if (Math.abs(bottom - t) <= SNAP_PX) { y = t - dragging.h; hLine = t; break; }
  }

  return { x, y, vLine, hLine };
}

// ── Canvas element previews ───────────────────────────────────────────────────

const SAMPLE_ROWS = [
  { index: '1', name: 'AC Installation',  description: '', partNumber: 'P-101', count: '2', amount: '4500.00', lineTotal: '9000.00' },
  { index: '2', name: 'Electrical Audit', description: '', partNumber: 'P-102', count: '1', amount: '5000.00', lineTotal: '5000.00' },
];

// ── Live-data substitution helpers ────────────────────────────────────────────
// When `live` is provided, canvas elements resolve real {{token}} values
// instead of showing raw tokens / fake sample rows — an unresolved or empty
// token renders as a dashed amber placeholder so a missing field is obvious
// at a glance while editing, instead of silently blank space.

function LiveToken({ label }: { label: string }) {
  return (
    <span
      title={`{{${label}}} has no value on this document`}
      className="inline-block px-1 mx-px border border-dashed border-amber-400 bg-amber-50 text-amber-600 rounded text-[0.85em] align-middle"
    >
      {label}
    </span>
  );
}

function renderLiveText(content: string, vars: Record<string, string>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(content))) {
    if (m.index > last) out.push(content.slice(last, m.index));
    const key = m[1].trim();
    const val = vars[key];
    out.push(val ? <span key={i}>{val}</span> : <LiveToken key={i} label={key} />);
    i++; last = re.lastIndex;
  }
  if (last < content.length) out.push(content.slice(last));
  return out;
}

/** `{{company.logo}}` → resolved URL; a literal URL typed directly passes through unchanged. */
function resolveLiveSrc(src: string, vars: Record<string, string>): string {
  const m = src.trim().match(/^\{\{([^}]+)\}\}$/);
  return m ? (vars[m[1].trim()] ?? '') : src;
}

/**
 * Substitutes {{token}} bindings inside a rich-HTML string (a gridtable
 * cell) for live preview. Unlike renderLiveText (which builds React text
 * nodes for a plain-text element), this returns an HTML string for
 * dangerouslySetInnerHTML, since a cell's literal content can itself contain
 * markup (bold, lists, images). The *substituted value* is HTML-escaped
 * before insertion — it's live document data, not admin-authored markup —
 * while the surrounding literal HTML the admin typed passes through as-is.
 */
function resolveRichLiveHtml(html: string, vars: Record<string, string>): string {
  const escVal = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Tokens inside an <img src="{{...}}"> attribute can't take the amber
  // placeholder markup used below — injecting a <span> mid-attribute breaks
  // the tag (the browser reads up to the span's own closing quote as the
  // "src", then everything after leaks out as stray visible text). Resolve
  // those first: real URL if we have one, otherwise just drop the src so the
  // <img> quietly renders nothing instead of corrupting the cell.
  const withImages = html.replace(/(<img\b[^>]*\bsrc=")\{\{([^}]+)\}\}(")/gi, (_, pre, key, post) => {
    const val = vars[key.trim()];
    return `${pre}${val ? escVal(val) : ''}${post}`;
  });
  // Remaining tokens are all plain text/markup context — safe to swap in the
  // amber "missing field" placeholder so gaps in the live document are obvious.
  return withImages.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const val = vars[key.trim()];
    if (val) return escVal(val);
    return `<span style="display:inline-block;padding:0 4px;border:1px dashed #f59e0b;background:#fffbeb;color:#d97706;border-radius:3px;font-size:0.85em;">${key.trim()}</span>`;
  });
}

function Cell({ live, value, style }: { live: boolean; value: string; style: React.CSSProperties }) {
  // Live cell values are pre-escaped mini-HTML fragments from the same
  // cellValue() the real PDF renderer uses (e.g. `<b>Name</b>`) — render them
  // as HTML, not as a literal-entities text node.
  return live ? <td style={style} dangerouslySetInnerHTML={{ __html: value }} /> : <td style={style}>{value}</td>;
}

function TablePreview({
  el, live, selected, onColumnsChange,
}: {
  el: DesignElement; live?: LiveData; selected?: boolean; onColumnsChange?: (columns: TableColumn[]) => void;
}) {
  const dataset = el.dataset ?? 'services';
  const cols: TableColumn[] = el.columns?.length
    ? el.columns
    : (dataset === 'parts'
        ? [{ key:'index',label:'#',width:6 },{ key:'name',label:'Part Name' },{ key:'partNumber',label:'Part No.',width:14 },{ key:'count',label:'Qty',width:10,align:'right' },{ key:'amount',label:'Unit Price',width:14,align:'right' },{ key:'lineTotal',label:'Amount',width:14,align:'right' }]
        : [{ key:'index',label:'#',width:6 },{ key:'name',label:'Description' },{ key:'count',label:'Qty',width:10,align:'right' },{ key:'amount',label:'Unit Price',width:14,align:'right' },{ key:'lineTotal',label:'Amount',width:14,align:'right' }]);
  const borders = el.showBorders !== false;
  const bd = borders ? `1px solid ${el.borderColor ?? '#e5e7eb'}` : 'none';
  const liveRows = live ? (dataset === 'parts' ? live.parts : live.services) : null;
  const rows: any[] = liveRows ?? SAMPLE_ROWS;

  // On-canvas direct editing (only when this table is the selected element
  // and a change handler was given): drag a column's right edge to resize,
  // double-click its label to rename — same underlying `columns` data the
  // sidebar Properties panel edits, just editable in place too.
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [editValue,  setEditValue]  = useState('');
  const dragRef = useRef<{ index: number; startX: number; startWidthPct: number } | null>(null);

  const patchColumn = (index: number, patch: Partial<TableColumn>) => {
    onColumnsChange?.(cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const startResize = (index: number, e: React.MouseEvent) => {
    if (!onColumnsChange) return;
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { index, startX: e.clientX, startWidthPct: cols[index].width ?? 100 / cols.length };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaPct = ((ev.clientX - drag.startX) / el.w) * 100;
      const width = Math.round(Math.min(100, Math.max(1, drag.startWidthPct + deltaPct)) * 10) / 10;
      patchColumn(drag.index, { width });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const commitRename = () => {
    if (editingCol !== null) patchColumn(editingCol, { label: editValue.trim() || cols[editingCol].label });
    setEditingCol(null);
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: el.fontSize ?? 11, fontFamily: el.fontFamily }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th
              key={i}
              onDoubleClick={onColumnsChange ? (e) => { e.stopPropagation(); setEditingCol(i); setEditValue(c.label); } : undefined}
              style={{ position: 'relative', padding: '5px 8px', border: bd, textAlign: c.align ?? 'left', background: el.headerBg ?? '#f3f4f6', color: el.headerColor ?? '#374151', width: c.width ? `${c.width}%` : undefined }}
            >
              {editingCol === i ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingCol(null); }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  className="w-full bg-white text-gray-800 border border-brand-400 rounded px-1"
                  style={{ fontSize: 'inherit', fontWeight: 'inherit' }}
                />
              ) : c.label}
              {selected && onColumnsChange && i < cols.length - 1 && (
                <div
                  onMouseDown={e => startResize(i, e)}
                  title="Drag to resize this column"
                  className="hover:bg-brand-400/50"
                  style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 5 }}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {live && liveRows && liveRows.length === 0 ? (
          <tr><td colSpan={cols.length} style={{ padding: '8px', textAlign: 'center', color: '#9ca3af', border: bd }}>No {dataset} listed</td></tr>
        ) : (
          rows.map((row, ri) => (
            <tr key={ri} style={{ background: el.altRowBg !== '' && ri % 2 === 1 ? (el.altRowBg ?? '#f9fafb') : undefined }}>
              {cols.map((c, ci) => (
                <Cell key={ci} live={!!live} value={(row as any)[c.key] ?? ''} style={{ padding: '4px 8px', border: bd, textAlign: c.align ?? 'left' }} />
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function TotalsPreview({ el, live }: { el: DesignElement; live?: LiveData }) {
  const rows = el.totalsRows?.length ? el.totalsRows : [{ key: 'subtotal' }, { key: 'gst' }, { key: 'total' }];
  const sample: Record<string, string> = {
    servicesSubtotal: '14,000.00', partsSubtotal: '1,500.00', subtotal: '15,500.00',
    discount: '-500.00', gst: '18% · 2,700.00', total: '17,700.00', paid: '0.00', balance: '17,700.00',
  };
  return (
    <div style={{ fontSize: el.fontSize ?? 11, color: el.color ?? '#111827', fontFamily: el.fontFamily }}>
      {rows.map((r, i) => {
        const last = (el.totalsEmphasizeLast !== false) && i === rows.length - 1;
        const value = live ? (live.totals[r.key] ?? '0.00') : (sample[r.key] ?? '0.00');
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: last ? 700 : 400, borderTop: last ? '2px solid #d1d5db' : undefined }}>
            <span style={{ color: last ? undefined : '#6b7280' }}>{r.label || TOTALS_KEY_LABELS[r.key] || r.key}</span>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function GridTablePreview({
  el, live, selected, onChange,
}: {
  el: DesignElement; live?: LiveData; selected?: boolean; onChange?: (patch: Partial<DesignElement>) => void;
}) {
  const cells  = el.gridCells ?? [];
  const cols   = el.gridCols ?? (cells[0]?.length ?? 0);
  const hasHeader = !!el.gridHeaderRow;
  const widths  = el.gridColWidths?.length === cols ? el.gridColWidths : undefined;
  const heights = el.gridRowHeights?.length === cells.length ? el.gridRowHeights : undefined;

  // Only one cell can be mid-edit at a time; its live (uncommitted) DOM
  // content is read straight from this ref rather than tracked in React
  // state, so typing/formatting/dropping never fights React's reconciler —
  // see the contentEditable block below for why.
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const colDragRef = useRef<{ col: number; startX: number; startWidthPct: number } | null>(null);
  const rowDragRef = useRef<{ row: number; startY: number; startHeightPx: number } | null>(null);
  // Set right before an Escape-driven cancel. Removing a focused contentEditable
  // from the DOM can itself fire a native blur (browser-dependent), which would
  // otherwise silently re-trigger commitEdit and save the very edit Escape was
  // meant to discard — this flag makes cancel win regardless of that timing.
  const cancelingRef = useRef(false);

  const patchCell = (r: number, c: number, value: string) => {
    onChange?.({ gridCells: cells.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row)) });
  };

  const commitEdit = () => {
    if (cancelingRef.current) { cancelingRef.current = false; setEditingCell(null); return; }
    if (editingCell && editableRef.current) patchCell(editingCell.r, editingCell.c, editableRef.current.innerHTML);
    setEditingCell(null);
  };

  const cancelEdit = () => { cancelingRef.current = true; setEditingCell(null); };

  /** Appends HTML (a dropped image tag, or a dropped variable's token text)
   *  to a cell — merging into whatever's already there (typed or dropped
   *  earlier), rather than replacing it, since a cell can hold several
   *  things at once. */
  const appendToCell = (r: number, c: number, htmlToAppend: string) => {
    const isEditingThis = editingCell?.r === r && editingCell?.c === c;
    const current = isEditingThis && editableRef.current ? editableRef.current.innerHTML : (cells[r]?.[c] ?? '');
    const next = current + htmlToAppend;
    if (isEditingThis && editableRef.current) editableRef.current.innerHTML = next; // keep the live DOM in sync too
    patchCell(r, c, next);
  };

  const handleCellDrop = (r: number, c: number, e: React.DragEvent) => {
    if (!onChange) return;
    e.preventDefault(); e.stopPropagation(); // don't also let this reach the canvas's own onDrop (would create a duplicate floating element)
    const variable = e.dataTransfer.getData('variable');
    const elemType = e.dataTransfer.getData('elemType');
    if (!variable) return;
    // Inline style keeps the image contained on canvas immediately; the
    // backend sanitizer strips style from <img> (only 'src' is allowed
    // there) and relies on its own equivalent .tpl-rich img CSS rule
    // instead, so the PDF output ends up sized the same way regardless.
    appendToCell(r, c, elemType === 'image' ? `<img src="${variable}" style="max-width:100%;height:auto;display:block;">` : variable);
  };

  const startColResize = (colIndex: number, e: React.MouseEvent) => {
    if (!onChange) return;
    e.stopPropagation(); e.preventDefault();
    const current = widths ?? Array.from({ length: cols }, () => 100 / cols);
    colDragRef.current = { col: colIndex, startX: e.clientX, startWidthPct: current[colIndex] };
    const onMove = (ev: MouseEvent) => {
      const drag = colDragRef.current;
      if (!drag) return;
      const deltaPct = ((ev.clientX - drag.startX) / el.w) * 100;
      const next = [...current];
      next[drag.col] = Math.round(Math.min(100, Math.max(3, drag.startWidthPct + deltaPct)) * 10) / 10;
      onChange({ gridColWidths: next });
    };
    const onUp = () => {
      colDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startRowResize = (rowIndex: number, e: React.MouseEvent) => {
    if (!onChange) return;
    e.stopPropagation(); e.preventDefault();
    const current = heights ?? cells.map(() => el.h / cells.length);
    rowDragRef.current = { row: rowIndex, startY: e.clientY, startHeightPx: current[rowIndex] };
    const onMove = (ev: MouseEvent) => {
      const drag = rowDragRef.current;
      if (!drag) return;
      const next = [...current];
      next[drag.row] = Math.round(Math.max(16, drag.startHeightPx + (ev.clientY - drag.startY)));
      onChange({ gridRowHeights: next });
    };
    const onUp = () => {
      rowDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: el.fontSize ?? 11, fontFamily: el.fontFamily }}>
      <colgroup>
        {Array.from({ length: cols }).map((_, ci) => (
          <col key={ci} style={{ width: `${widths?.[ci] ?? 100 / cols}%` }} />
        ))}
      </colgroup>
      <tbody>
        {cells.map((row, ri) => (
          <tr key={ri} style={{ height: heights?.[ri] ? `${heights[ri]}px` : undefined }}>
            {row.map((val, ci) => {
              const isHeaderCell = hasHeader && ri === 0;
              const isEditing = editingCell?.r === ri && editingCell?.c === ci;
              return (
                <td
                  key={ci}
                  onClick={onChange && !isEditing ? (e) => { e.stopPropagation(); cancelingRef.current = false; setEditingCell({ r: ri, c: ci }); } : undefined}
                  onDragOver={onChange ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
                  onDrop={onChange ? (e) => handleCellDrop(ri, ci, e) : undefined}
                  style={{
                    position: 'relative', border: '1px solid #e5e7eb', padding: '5px 8px',
                    // The formatting toolbar sits just above the cell while editing —
                    // it would otherwise be clipped by this cell's own overflow.
                    overflow: isEditing ? 'visible' : 'hidden',
                    background: isHeaderCell ? '#f3f4f6' : undefined,
                    fontWeight: isHeaderCell ? 'bold' : 'normal',
                    color: isHeaderCell ? '#374151' : undefined,
                    cursor: onChange ? 'text' : undefined,
                  }}
                >
                  {isEditing ? (
                    <>
                      <div
                        onMouseDown={e => e.stopPropagation()}
                        className="absolute -top-7 left-0 z-20 flex gap-0.5 bg-white border border-gray-200 rounded shadow-md p-0.5 whitespace-nowrap"
                      >
                        <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('bold')}
                          title="Bold" className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-gray-100 rounded">B</button>
                        <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('italic')}
                          title="Italic" className="w-5 h-5 flex items-center justify-center text-[10px] italic hover:bg-gray-100 rounded">I</button>
                        <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('insertUnorderedList')}
                          title="Bullet list" className="w-5 h-5 flex items-center justify-center text-[11px] hover:bg-gray-100 rounded">•≡</button>
                        <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('insertOrderedList')}
                          title="Numbered list" className="w-5 h-5 flex items-center justify-center text-[9px] hover:bg-gray-100 rounded">1.≡</button>
                        <button onMouseDown={e => e.preventDefault()} onClick={() => { commitEdit(); }}
                          title="Done" className="w-5 h-5 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded">✓</button>
                      </div>
                      <div
                        ref={editableRef}
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: val }}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Escape') { cancelEdit(); e.currentTarget.blur(); } }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        className="tpl-rich-edit outline-none min-h-[1em]"
                        style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
                      />
                    </>
                  ) : live ? (
                    val
                      ? <div className="tpl-rich" dangerouslySetInnerHTML={{ __html: resolveRichLiveHtml(val, live.vars) }} />
                      : null
                  ) : val ? (
                    <div className="tpl-rich" dangerouslySetInnerHTML={{ __html: val }} />
                  ) : (
                    onChange && <span className="text-gray-300">Click to edit, or drag a variable/image here</span>
                  )}
                  {selected && onChange && ri === 0 && ci < cols - 1 && (
                    <div
                      onMouseDown={e => startColResize(ci, e)}
                      title="Drag to resize this column"
                      className="hover:bg-brand-400/50"
                      style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 5 }}
                    />
                  )}
                  {selected && onChange && ci === 0 && ri < cells.length - 1 && (
                    <div
                      onMouseDown={e => startRowResize(ri, e)}
                      title="Drag to resize this row"
                      className="hover:bg-brand-400/50"
                      style={{ position: 'absolute', left: 0, right: 0, bottom: -3, height: 6, cursor: 'row-resize', zIndex: 5 }}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ElementPreview({
  el, live, selected, onColumnsChange, onGridChange,
}: {
  el: DesignElement; live?: LiveData; selected?: boolean;
  onColumnsChange?: (columns: TableColumn[]) => void;
  onGridChange?: (patch: Partial<DesignElement>) => void;
}) {
  if (el.type === 'divider') {
    return <div style={{ width: '100%', height: '100%', borderTop: `${el.borderWidth ?? 1}px solid ${el.borderColor ?? '#e5e7eb'}` }} />;
  }
  if (el.type === 'box') {
    return <div style={{ width: '100%', height: '100%', background: el.backgroundColor ?? '#f3f4f6', border: `${el.borderWidth ?? 1}px solid ${el.borderColor ?? '#e5e7eb'}`, borderRadius: el.borderRadius ?? 4 }} />;
  }
  if (el.type === 'image') {
    if (live) {
      const src = el.src ? resolveLiveSrc(el.src, live.vars) : '';
      if (src) return <img src={src} style={{ width: '100%', height: '100%', objectFit: el.objectFit ?? 'contain' }} />;
      return (
        <div className="w-full h-full flex items-center justify-center text-center px-1 bg-amber-50 border border-dashed border-amber-300 text-[9px] text-amber-600 rounded overflow-hidden">
          No image on this document
        </div>
      );
    }
    // Design mode, no live doc picked: a literal URL (e.g. an uploaded asset)
    // is directly loadable, so show the real picture, not just its address —
    // only an unresolved {{token}} has to fall back to placeholder text.
    if (el.src && !/^\{\{.*\}\}$/.test(el.src.trim())) {
      return <img src={el.src} style={{ width: '100%', height: '100%', objectFit: el.objectFit ?? 'contain' }} />;
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400 rounded overflow-hidden">
        {el.src ?? '{{company.logo}}'}
      </div>
    );
  }
  if (el.type === 'table')     return <div className="w-full h-full overflow-hidden"><TablePreview el={el} live={live} selected={selected} onColumnsChange={onColumnsChange} /></div>;
  if (el.type === 'totals')    return <div className="w-full h-full overflow-hidden"><TotalsPreview el={el} live={live} /></div>;
  if (el.type === 'gridtable') return <div className="w-full h-full overflow-hidden"><GridTablePreview el={el} live={live} selected={selected} onChange={onGridChange} /></div>;
  if (el.type === 'richtext') {
    const isTerms = el.content?.includes('doc.terms');
    const isNotes = el.content?.includes('doc.notes');
    const heading = isTerms ? 'Terms & Conditions' : isNotes ? 'Notes' : '';
    const liveText = live ? (isTerms ? live.vars['doc.terms'] : isNotes ? live.vars['doc.notes'] : '') : '';
    const showsNothingLive = live && (isTerms || isNotes) && !liveText;
    return (
      <div className="w-full h-full overflow-hidden border border-dashed border-purple-200 bg-purple-50/40 rounded px-2 py-1"
        style={{ fontSize: el.fontSize ?? 11, color: el.color ?? '#4b5563', fontFamily: el.fontFamily }}>
        <span className="text-[9px] font-bold text-purple-400 uppercase">{heading || 'Rich text'}</span>
        {showsNothingLive ? (
          <div className="line-clamp-2 text-amber-500">(empty on this document — won't render)</div>
        ) : (
          <div className="line-clamp-3">
            {live ? liveText : (heading ? `${heading} content…` : 'Rich text content…')}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize:   el.fontSize ?? 13,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight ?? 'normal',
        fontStyle:  el.fontStyle ?? 'normal',
        lineHeight: el.lineHeight,
        color:      el.color ?? '#111827',
        textAlign:  (el.textAlign as any) ?? 'left',
        padding:    el.padding,
        width: '100%', height: '100%',
        overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}
    >
      {live ? renderLiveText(el.content ?? '', live.vars) : (el.content ?? '')}
    </div>
  );
}

// ── Properties panel ──────────────────────────────────────────────────────────

function ColorInput({ value, fallback, onChange }: { value?: string; fallback: string; onChange: (v: string) => void }) {
  const cls = "w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400";
  return (
    <div className="flex gap-2 items-center">
      <input type="color" value={value ?? fallback} onChange={e => onChange(e.target.value)} className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5" />
      <input className={`${cls} flex-1`} value={value ?? fallback} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function PropertiesPanel({
  el, onChange, onDelete,
}: {
  el: DesignElement;
  onChange: (patch: Partial<DesignElement>) => void;
  onDelete: () => void;
}) {
  const inp = (label: string, node: React.ReactNode) => (
    <div className="mb-3">
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      {node}
    </div>
  );
  const cls = "w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400";

  const hasTypography = el.type === 'text' || el.type === 'richtext' || el.type === 'table' || el.type === 'totals' || el.type === 'gridtable';
  const colKeys = (el.dataset ?? 'services') === 'parts' ? PART_COLUMN_KEYS : SERVICE_COLUMN_KEYS;

  const patchColumn = (i: number, patch: Partial<TableColumn>) => {
    const cols = [...(el.columns ?? [])];
    cols[i] = { ...cols[i], ...patch };
    onChange({ columns: cols });
  };
  const reorderColumns = (from: number, to: number) => {
    if (from === to) return;
    const cols = [...(el.columns ?? [])];
    const [moved] = cols.splice(from, 1);
    cols.splice(to, 0, moved);
    onChange({ columns: cols });
  };
  const dragSrc = useRef<number | null>(null);

  // Keep whatever customization still applies instead of wiping every column
  // when switching services↔parts — only a column whose key doesn't exist in
  // the new dataset (e.g. partNumber, switching to services) gets dropped.
  const handleDatasetChange = (next: 'services' | 'parts') => {
    const allowed: readonly string[] = next === 'parts' ? PART_COLUMN_KEYS : SERVICE_COLUMN_KEYS;
    const kept = (el.columns ?? []).filter((c) => allowed.includes(c.key));
    onChange({ dataset: next, columns: kept.length ? kept : undefined });
  };

  return (
    <div className="p-3 text-xs">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-700 capitalize">{el.type} Element</span>
        <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {inp('Position', (
        <div className="grid grid-cols-2 gap-1">
          <input className={cls} type="number" value={Math.round(el.x)} onChange={e => onChange({ x: +e.target.value })} placeholder="X" />
          <input className={cls} type="number" value={Math.round(el.y)} onChange={e => onChange({ y: +e.target.value })} placeholder="Y" />
        </div>
      ))}

      {inp('Size', (
        <div className="grid grid-cols-2 gap-1">
          <input className={cls} type="number" value={Math.round(el.w)} onChange={e => onChange({ w: +e.target.value })} placeholder="W" />
          <input className={cls} type="number" value={Math.round(el.h)} onChange={e => onChange({ h: +e.target.value })} placeholder="H" />
        </div>
      ))}

      {inp('Layer (z-index)', (
        <input className={cls} type="number" min={0} max={999} value={el.z ?? 1} onChange={e => onChange({ z: +e.target.value })} />
      ))}

      {el.type === 'text' && inp('Content', (
        <textarea className={`${cls} resize-none`} rows={3} value={el.content ?? ''} onChange={e => onChange({ content: e.target.value })} />
      ))}

      {el.type === 'richtext' && inp('Binds to', (
        <select className={cls} value={el.content ?? '{{doc.notes}}'} onChange={e => onChange({ content: e.target.value })}>
          <option value="{{doc.notes}}">Document Notes</option>
          <option value="{{doc.terms}}">Terms &amp; Conditions</option>
        </select>
      ))}

      {hasTypography && (<>
        {inp('Font', (
          <select className={cls} value={el.fontFamily ?? 'Arial'} onChange={e => onChange({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        ))}
        {inp('Font Size', (
          <input className={cls} type="number" min={6} max={72} value={el.fontSize ?? 13} onChange={e => onChange({ fontSize: +e.target.value })} />
        ))}
      </>)}

      {el.type === 'text' && (<>
        {inp('Weight / Style', (
          <div className="grid grid-cols-2 gap-1">
            <select className={cls} value={el.fontWeight ?? 'normal'} onChange={e => onChange({ fontWeight: e.target.value as any })}>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
            <select className={cls} value={el.fontStyle ?? 'normal'} onChange={e => onChange({ fontStyle: e.target.value as any })}>
              <option value="normal">Regular</option>
              <option value="italic">Italic</option>
            </select>
          </div>
        ))}
        {inp('Line Height', (
          <input className={cls} type="number" step={0.1} min={0.5} max={4} value={el.lineHeight ?? 1.4} onChange={e => onChange({ lineHeight: +e.target.value })} />
        ))}
        {inp('Padding', (
          <input className={cls} type="number" min={0} max={100} value={el.padding ?? 0} onChange={e => onChange({ padding: +e.target.value })} />
        ))}
        {inp('Align', (
          <div className="flex gap-1">
            {(['left','center','right'] as const).map(a => (
              <button key={a} onClick={() => onChange({ textAlign: a })}
                className={`flex-1 py-1 text-[10px] rounded border capitalize ${el.textAlign === a ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {a}
              </button>
            ))}
          </div>
        ))}
      </>)}

      {(el.type === 'text' || el.type === 'richtext' || el.type === 'totals') && inp('Color', (
        <ColorInput value={el.color} fallback="#111827" onChange={v => onChange({ color: v })} />
      ))}

      {el.type === 'image' && (<>
        {inp('Source variable', (
          <input className={cls} value={el.src ?? ''} onChange={e => onChange({ src: e.target.value })} placeholder="{{company.logo}}" />
        ))}
        {inp('Fit', (
          <select className={cls} value={el.objectFit ?? 'contain'} onChange={e => onChange({ objectFit: e.target.value as any })}>
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Stretch</option>
          </select>
        ))}
      </>)}

      {el.type === 'table' && (<>
        {inp('Data Source', (
          <select className={cls} value={el.dataset ?? 'services'}
            onChange={e => handleDatasetChange(e.target.value as 'services' | 'parts')}>
            <option value="services">Services</option>
            <option value="parts">Parts</option>
          </select>
        ))}
        {inp('Columns', (
          <div className="space-y-1.5">
            <p className="text-[9px] text-gray-400 -mt-0.5">Tip: drag the ⠿ handle to reorder, or edit a column directly on the canvas — drag its right edge to resize, double-click its label to rename.</p>
            {(el.columns ?? []).map((c, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => { dragSrc.current = i; }}
                onDragEnter={e => { e.preventDefault(); if (dragSrc.current !== null && dragSrc.current !== i) { reorderColumns(dragSrc.current, i); dragSrc.current = i; } }}
                onDragOver={e => e.preventDefault()}
                onDragEnd={() => { dragSrc.current = null; }}
                className="border border-gray-100 rounded p-1.5 space-y-1 bg-gray-50"
              >
                <div className="flex items-center gap-1">
                  <span className="cursor-grab active:cursor-grabbing text-gray-300 px-0.5" title="Drag to reorder">⠿</span>
                  <select className={`${cls} flex-1`} value={c.key} onChange={e => patchColumn(i, { key: e.target.value })}>
                    {colKeys.map(k => <option key={k} value={k}>{COLUMN_KEY_LABELS[k]}</option>)}
                  </select>
                  <button onClick={() => onChange({ columns: (el.columns ?? []).filter((_, j) => j !== i) })}
                    className="px-1 text-red-300 hover:text-red-500">✕</button>
                </div>
                <div className="flex items-center gap-1">
                  <input className={`${cls} flex-1`} value={c.label} placeholder="Label"
                    onChange={e => patchColumn(i, { label: e.target.value })} />
                  <input className={`${cls} w-14`} type="number" min={1} max={100} value={c.width ?? ''} placeholder="W%"
                    onChange={e => patchColumn(i, { width: e.target.value ? +e.target.value : undefined })} />
                  <select className={`${cls} w-16`} value={c.align ?? 'left'} onChange={e => patchColumn(i, { align: e.target.value as any })}>
                    <option value="left">L</option><option value="center">C</option><option value="right">R</option>
                  </select>
                </div>
              </div>
            ))}
            <button
              onClick={() => onChange({ columns: [...(el.columns ?? []), { key: 'name', label: 'Column' }] })}
              className="w-full py-1 text-[10px] border border-dashed border-gray-300 rounded text-gray-500 hover:bg-gray-50">
              + Add column {!(el.columns?.length) && '(empty = default columns)'}
            </button>
          </div>
        ))}
        {inp('Header Colors', (
          <div className="space-y-1">
            <ColorInput value={el.headerBg}    fallback="#f3f4f6" onChange={v => onChange({ headerBg: v })} />
            <ColorInput value={el.headerColor} fallback="#374151" onChange={v => onChange({ headerColor: v })} />
          </div>
        ))}
        {inp('Alternate Row', (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={el.altRowBg !== ''} onChange={e => onChange({ altRowBg: e.target.checked ? '#f9fafb' : '' })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
            <span className="text-[10px] text-gray-500">Banded rows</span>
          </div>
        ))}
        {inp('Borders', (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={el.showBorders !== false} onChange={e => onChange({ showBorders: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
            <span className="text-[10px] text-gray-500">Cell borders</span>
          </div>
        ))}
      </>)}

      {el.type === 'totals' && (<>
        {inp('Rows', (
          <div className="space-y-1">
            {TOTALS_KEYS.map(k => {
              const idx = (el.totalsRows ?? []).findIndex(r => r.key === k);
              const active = idx >= 0;
              return (
                <div key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={active}
                    onChange={e => {
                      const rows = [...(el.totalsRows ?? [])];
                      if (e.target.checked) rows.push({ key: k });
                      else rows.splice(idx, 1);
                      onChange({ totalsRows: rows });
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 shrink-0" />
                  <span className="text-[10px] text-gray-600 w-16 shrink-0">{TOTALS_KEY_LABELS[k]}</span>
                  {active && (
                    <input className={`${cls} flex-1`} placeholder="Custom label"
                      value={el.totalsRows?.[idx]?.label ?? ''}
                      onChange={e => {
                        const rows = [...(el.totalsRows ?? [])];
                        rows[idx] = { ...rows[idx], label: e.target.value || undefined };
                        onChange({ totalsRows: rows });
                      }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {inp('Emphasize last row', (
          <input type="checkbox" checked={el.totalsEmphasizeLast !== false}
            onChange={e => onChange({ totalsEmphasizeLast: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
        ))}
      </>)}

      {el.type === 'gridtable' && (<>
        {inp('Rows × Columns', (
          <div className="grid grid-cols-2 gap-1">
            {/* Uncontrolled + commit-on-blur/Enter (not onChange) — resizing
                truncates/pads gridCells, so applying it per-keystroke would
                destructively wipe rows/cols mid-typing (e.g. backspacing "15"
                down to "1" while retyping "13"). `key` remounts the input
                with a fresh defaultValue whenever the selected element or its
                committed row count changes, instead of fighting a stale DOM value. */}
            <input className={cls} type="number" min={1} max={30} defaultValue={el.gridRows ?? 1} key={`rows-${el.id}-${el.gridRows}`}
              onBlur={e => {
                const rows = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || (el.gridRows ?? 1)));
                if (rows === (el.gridRows ?? 1)) return;
                const cols = el.gridCols ?? 1;
                const cells = el.gridCells ?? [];
                const nextCells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cells[r]?.[c] ?? ''));
                // Row count changed → gridRowHeights (per-row) is now the wrong
                // length and must be dropped; gridColWidths (per-column) is
                // untouched by a row-count change, so it's left alone.
                onChange({ gridRows: rows, gridCells: nextCells, gridRowHeights: undefined });
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <input className={cls} type="number" min={1} max={12} defaultValue={el.gridCols ?? 1} key={`cols-${el.id}-${el.gridCols}`}
              onBlur={e => {
                const cols = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || (el.gridCols ?? 1)));
                if (cols === (el.gridCols ?? 1)) return;
                const rows = el.gridRows ?? 1;
                const cells = el.gridCells ?? [];
                const nextCells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cells[r]?.[c] ?? ''));
                // Column count changed → gridColWidths (per-column) is now the
                // wrong length and must be dropped; gridRowHeights (per-row) is
                // untouched by a column-count change, so it's left alone.
                onChange({ gridCols: cols, gridCells: nextCells, gridColWidths: undefined });
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          </div>
        ))}
        {inp('Header Row', (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!el.gridHeaderRow} onChange={e => onChange({ gridHeaderRow: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
            <span className="text-[10px] text-gray-500">Style first row as header (bold + shaded)</span>
          </div>
        ))}
        <p className="text-[9px] text-gray-400">
          Click a cell to edit it — use the mini toolbar for bold/italic/lists, drag a variable or an uploaded image straight into a cell,
          and mix them freely (a cell can hold text, a list, and an image together). Drag a top-row cell's right edge to resize its column,
          or a left-column cell's bottom edge to resize its row.
        </p>
      </>)}

      {(el.type === 'box' || el.type === 'divider' || el.type === 'table') && (<>
        {el.type === 'box' && inp('Background', (
          <ColorInput value={el.backgroundColor} fallback="#f3f4f6" onChange={v => onChange({ backgroundColor: v })} />
        ))}
        {inp('Border Color', (
          <ColorInput value={el.borderColor} fallback="#e5e7eb" onChange={v => onChange({ borderColor: v })} />
        ))}
        {el.type !== 'table' && inp('Border Width', (
          <input className={cls} type="number" min={0} max={20} value={el.borderWidth ?? 1} onChange={e => onChange({ borderWidth: +e.target.value })} />
        ))}
        {el.type === 'box' && inp('Corner Radius', (
          <input className={cls} type="number" min={0} max={100} value={el.borderRadius ?? 4} onChange={e => onChange({ borderRadius: +e.target.value })} />
        ))}
      </>)}
    </div>
  );
}

// ── Real-data preview modal ───────────────────────────────────────────────────

function PreviewModal({
  docType, elements, page, header, footer, docs, initialDocId, onClose,
}: {
  docType: DocType;
  elements: DesignElement[];
  page: { marginTopPx: number; marginBottomPx: number };
  header: { enabled: boolean; heightPx: number; elements: DesignElement[] };
  footer: { enabled: boolean; heightPx: number; elements: DesignElement[] };
  docs: any[];
  initialDocId: string;
  onClose: () => void;
}) {
  const [docId, setDocId] = useState(initialDocId);
  const [html, setHtml]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [downloading, setDownloading] = useState(false);

  const runPreview = async (id: string) => {
    setDocId(id);
    if (!id) return;
    setLoading(true); setError(''); setHtml('');
    try {
      const res = await previewDraftHtml(MODULE_FOR_DOCTYPE[docType], id, { elements, page, header, footer });
      setHtml(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Preview failed');
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    if (!docId) return;
    setDownloading(true); setError('');
    try {
      const doc = docs.find((d: any) => d._id === docId);
      const label = doc?.[ID_FIELD[docType]] ?? docId;
      await downloadDraftPdf(MODULE_FOR_DOCTYPE[docType], docId, `${docType}-${label}.pdf`, { elements, page, header, footer });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Download failed');
    } finally { setDownloading(false); }
  };

  // Auto-load the initial (e.g. Live Data mode's) selection on open, if any.
  useEffect(() => {
    if (initialDocId) runPreview(initialDocId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Preview with real data</h3>
            <select
              value={docId}
              onChange={e => runPreview(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
            >
              <option value="">Select a {docType}…</option>
              {docs.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d[ID_FIELD[docType]] ?? d._id}{d.title ? ` — ${d.title}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!docId || loading || downloading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 overflow-hidden">
          {loading && <div className="h-full flex items-center justify-center text-sm text-gray-400">Rendering…</div>}
          {error   && <div className="h-full flex items-center justify-center text-sm text-red-500">{error}</div>}
          {!loading && !error && html && (
            <iframe title="preview" srcDoc={html} className="w-full h-full bg-white" />
          )}
          {!loading && !error && !html && (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Pick a document above to see this template with its real data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TemplateDesignerPage() {
  const navigate             = useNavigate();
  const [params]             = useSearchParams();
  const initDocType          = (params.get('docType') ?? 'invoice') as DocType;
  const editId               = params.get('id') ?? '';

  const [docType,   setDocType]   = useState<DocType>(initDocType);
  const [tplName,   setTplName]   = useState('Untitled Template');
  const [pageCfg,   setPageCfg]   = useState({ marginTopPx: 24, marginBottomPx: 32 });
  const [selectedId,setSelectedId]= useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [openGroups,setOpenGroups]= useState<Record<string, boolean>>({ Company: true });
  const [showPreview, setShowPreview] = useState(false);
  const [liveMode,  setLiveMode]  = useState(false);
  const [liveDocId, setLiveDocIdState] = useState('');

  // Body / header / footer are three independent element arrays — `region`
  // selects which one the canvas + properties panel are currently editing.
  // `elements`/`setElements` below are derived accessors so the rest of this
  // component (drop handler, add/patch/delete, Rnd mapping, PropertiesPanel)
  // keeps working unchanged regardless of which region is active.
  const [region,         setRegion]         = useState<'body' | 'header' | 'footer'>('body');
  const [bodyElements,   setBodyElements]   = useState<DesignElement[]>([]);
  const [headerElements, setHeaderElements] = useState<DesignElement[]>([]);
  const [footerElements, setFooterElements] = useState<DesignElement[]>([]);
  const [headerCfg, setHeaderCfg] = useState({ enabled: false, heightPx: 60 });
  const [footerCfg, setFooterCfg] = useState({ enabled: false, heightPx: 60 });

  const elements = region === 'header' ? headerElements : region === 'footer' ? footerElements : bodyElements;
  const setElements = region === 'header' ? setHeaderElements : region === 'footer' ? setFooterElements : setBodyElements;

  // Alignment guide lines, shown live while dragging an element (Canva/Figma-style).
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  // Grid Table size picker (Word/Excel-style hover-a-grid, pick R×C)
  const [showGridPicker, setShowGridPicker] = useState(false);
  const [gridPickerHover, setGridPickerHover] = useState<{ r: number; c: number } | null>(null);
  const gridPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showGridPicker) return;
    const onClickOutside = (e: MouseEvent) => {
      if (gridPickerRef.current && !gridPickerRef.current.contains(e.target as Node)) setShowGridPicker(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showGridPicker]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: allTemplates, isLoading: listLoading } = useCustomTemplatesQuery(docType);
  const { data: catalogGroups = [] } = useTemplateCatalogQuery(docType);
  const createMut     = useCustomTemplateCreate();
  const updateMut     = useCustomTemplateUpdate();
  const deleteMut     = useCustomTemplateDelete();
  const setDefaultMut = useCustomTemplateSetDefault();
  const seedStarterMut = useSeedStarterTemplate();

  // Uploads panel — tenant image library, draggable onto canvas like any
  // other palette item.
  const { data: assets = [] } = useTemplateAssetsQuery();
  const uploadAssetMut = useTemplateAssetUpload();
  const deleteAssetMut = useTemplateAssetDelete();
  const [uploadError, setUploadError] = useState('');
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  const handleAssetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    setUploadError('');
    uploadAssetMut.mutate(file, {
      onError: (err: any) => setUploadError(err?.response?.data?.message ?? 'Upload failed'),
    });
  };

  // PDF/Image Template Analyzer — uploads an existing design and loads the
  // AI-generated draft straight into the current (unsaved) body canvas state,
  // exactly like a brand-new blank template. Nothing is saved server-side by
  // this call — it only becomes a real template when the user clicks the
  // normal "Save Template" button below, same as any hand-built one.
  const analyzeMut = useTemplateAnalysisMutation();
  const [analysisError, setAnalysisError] = useState('');
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalysisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (bodyElements.length > 0 && !window.confirm('This replaces everything currently on the canvas with the analyzed draft. Continue?')) {
      return;
    }
    setAnalysisError('');
    setAnalysisWarnings([]);
    analyzeMut.mutate({ file, docType }, {
      onSuccess: (result) => {
        setBodyElements(result.elements);
        setSelectedId(null);
        if (result.warnings.length) setAnalysisWarnings(result.warnings);
      },
      onError: (err: any) => setAnalysisError(err?.response?.data?.message ?? 'Analysis failed — please try again'),
    });
  };

  // Dragging an uploaded asset works exactly like dragging a catalog
  // variable, except `variable` is the real image URL, not a {{token}} —
  // handleCanvasDrop already assigns whatever it receives straight into
  // el.src for image drops, so no drop-handling changes are needed.
  const handleAssetDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData('variable', url);
    e.dataTransfer.setData('elemType', 'image');
    e.dataTransfer.setData('varKey', '');
  };

  // Recent documents of the current docType — used by both the Live Data
  // picker and PreviewModal. All four hooks always called (React rules).
  const inv = useInvoicesListQuery({ page: 1, limit: 10 });
  const quo = useQuotationsListQuery({ page: 1, limit: 10 });
  const con = useContractsListQuery({ page: 1, limit: 10 });
  const wor = useWorkordersListQuery({ page: 1, limit: 10 });
  const docs: any[] =
    (docType === 'invoice' ? inv.data?.items
    : docType === 'quotation' ? quo.data?.items
    : docType === 'contract' ? con.data?.items
    : wor.data?.items) ?? [];

  const liveDocStorageKey = `tpl-designer:live-doc:${docType}`;
  const setLiveDocId = (id: string) => {
    setLiveDocIdState(id);
    try {
      if (id) localStorage.setItem(liveDocStorageKey, id); else localStorage.removeItem(liveDocStorageKey);
    } catch { /* storage full/blocked — the picked doc just won't be remembered next visit */ }
  };
  // docType changed — optimistically restore its last-picked live doc.
  useEffect(() => {
    let stored = '';
    try { stored = localStorage.getItem(liveDocStorageKey) ?? ''; } catch { /* storage blocked — fall back to none picked */ }
    setLiveDocIdState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType]);
  // Once the doc list has loaded, drop a stale/deleted id rather than 404-ing.
  useEffect(() => {
    if (!liveDocId || docs.length === 0) return;
    if (!docs.some((d: any) => d._id === liveDocId)) setLiveDocId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, liveDocId]);

  const { data: liveData } = useLiveDataQuery(MODULE_FOR_DOCTYPE[docType], liveMode ? liveDocId : '');

  const selected = elements.find(e => e.id === selectedId) ?? null;

  // Flow ranges for overlap warnings ("may shift in final PDF") — only
  // 'table' is a flow element now, since it's the only type with a
  // genuinely unbounded row count (richtext/gridtable render as fixed-height
  // absolute elements, so nothing else can collide with their real content).
  const flowRanges = elements
    .filter(e => FLOW_TYPES.has(e.type))
    .map(e => ({ id: e.id, top: e.y, bottom: e.y + e.h }));
  // Warn when a fixed element's vertical range intersects a table block's
  // AT ALL — not just when it starts above and dips in. An element
  // positioned entirely INSIDE a table's range (e.g. an image visually
  // dropped "onto" a table instead of into one of its cells) looks fine
  // here on the free-position canvas, but the table renders as real
  // document flow in the PDF — there's no guarantee this element lands
  // anywhere near the same spot, since it isn't actually part of the
  // table's content.
  const overlapsFlow = (el: DesignElement) =>
    !FLOW_TYPES.has(el.type) &&
    flowRanges.some(r => r.id !== el.id && el.y < r.bottom && el.y + el.h > r.top);

  // Arrow-key nudge for precise positioning — 1px, or 10px with Shift.
  // Ignored while a form field has focus so typing/spinners keep working.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft')  dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp')    dy = -step;
      else if (e.key === 'ArrowDown')  dy = step;
      else return;
      e.preventDefault();
      setElements(prev => prev.map(el => el.id === selectedId ? { ...el, x: Math.max(0, el.x + dx), y: el.y + dy } : el));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, setElements]);

  // ── Unsaved-draft persistence ───────────────────────────────────────────────
  // Editing here is easy to lose by accident — leaving for another page (or
  // just closing the tab) fully unmounts this component and wipes all local
  // state. Autosave the in-progress design to localStorage on every change,
  // and restore it on mount, so navigating away and back no longer loses
  // work. Cleared only on an explicit action: a successful Save, or clicking
  // Back (the closest thing to a "discard/cancel" in this UI).
  const draftKey = editId ? `tpl-designer:draft:id:${editId}` : `tpl-designer:draft:new:${docType}`;
  const loadedRef = useRef<string>('');
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    // localStorage access itself (not just JSON.parse) can throw — some
    // private-browsing configurations block it outright. Keep the whole
    // attempt inside one try/catch so a blocked/corrupt draft degrades to
    // "start blank/server-loaded" instead of leaving draftHydrated stuck at
    // false, which would silently disable autosave for the rest of the
    // session (the write effect below is gated on it).
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.tplName)        setTplName(draft.tplName);
        if (draft.bodyElements)   setBodyElements(draft.bodyElements);
        if (draft.headerElements) setHeaderElements(draft.headerElements);
        if (draft.footerElements) setFooterElements(draft.footerElements);
        if (draft.headerCfg)      setHeaderCfg(draft.headerCfg);
        if (draft.footerCfg)      setFooterCfg(draft.footerCfg);
        if (draft.pageCfg)        setPageCfg(draft.pageCfg);
        // A restored draft for an existing template outranks the server copy —
        // tell the server-load effect below this editId is already handled.
        if (editId) loadedRef.current = editId;
      }
    } catch { /* blocked or corrupt draft — ignore, start from a blank/server-loaded canvas */ }
    // Batches with any setState calls above into one render, so the very
    // first write below (gated on this) sees the restored values, not the
    // empty initial state — no risk of the write effect clobbering the
    // draft it just read before the restore has actually landed.
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    // A full storage quota is a realistic real-world failure (not exotic) —
    // must not throw uncaught inside an effect and take the whole page down
    // over an ordinary edit; autosave just silently skips that write.
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        tplName, bodyElements, headerElements, footerElements, headerCfg, footerCfg, pageCfg,
      }));
    } catch { /* storage full/blocked — this edit just won't be recoverable after a reload */ }
  }, [draftHydrated, draftKey, tplName, bodyElements, headerElements, footerElements, headerCfg, footerCfg, pageCfg]);

  const clearDraft = () => { try { localStorage.removeItem(draftKey); } catch { /* nothing to clean up if storage is unavailable */ } };

  // Load template into canvas when allTemplates arrives and editId is set
  useEffect(() => {
    if (!editId) return;
    if (loadedRef.current === editId) return;
    const tpl = allTemplates?.find((t: any) => t._id === editId);
    if (!tpl) return;
    loadedRef.current = editId;
    setTplName(tpl.name);
    setDocType(tpl.docType);
    setBodyElements(tpl.elements ?? []);
    setHeaderElements(tpl.header?.elements ?? []);
    setFooterElements(tpl.footer?.elements ?? []);
    setHeaderCfg({ enabled: tpl.header?.enabled ?? false, heightPx: tpl.header?.heightPx ?? 60 });
    setFooterCfg({ enabled: tpl.footer?.enabled ?? false, heightPx: tpl.footer?.heightPx ?? 60 });
    if (tpl.page) setPageCfg(tpl.page);
  }, [editId, allTemplates]);

  // ── Drag from variable tree ─────────────────────────────────────────────────
  const handleVarDragStart = (e: React.DragEvent, key: string, elemType: string) => {
    e.dataTransfer.setData('variable', `{{${key}}}`);
    e.dataTransfer.setData('elemType', elemType);
    e.dataTransfer.setData('varKey', key);
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const variable = e.dataTransfer.getData('variable');
    const type     = e.dataTransfer.getData('elemType') as ElemType;
    const varKey   = e.dataTransfer.getData('varKey');
    if (!variable || !type) return;
    // Header/footer are fixed-height repeating bands — table/richtext/
    // gridtable can't live there (mirrors the backend zod refine).
    if (region !== 'body' && HEADER_FOOTER_EXCLUDED_TYPES.has(type)) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const size = defaultSize(type);
    const el: DesignElement = {
      id: uid(), type, x, y, ...size,
      ...defaultForType(type, variable),
    };
    if (type === 'text')  el.content = variable;
    if (type === 'image') el.src = variable;
    if (type === 'table') el.dataset = varKey?.startsWith('parts') ? 'parts' : 'services';
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }, [region, setElements]);

  // ── Add blank element ───────────────────────────────────────────────────────
  const addElement = (type: ElemType) => {
    if (region !== 'body' && HEADER_FOOTER_EXCLUDED_TYPES.has(type)) return;
    const size = defaultSize(type);
    const el: DesignElement = {
      id: uid(), type,
      x: 40, y: 40,
      ...size,
      ...defaultForType(type),
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const patchElement = (id: string, patch: Partial<DesignElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const header = { ...headerCfg, elements: headerElements };
  const footer = { ...footerCfg, elements: footerElements };

  // ── Reflow parity ────────────────────────────────────────────────────────────
  // The canvas positions every element at fixed design-time coordinates, but
  // the real renderer treats 'table' as a flow element whose real height
  // comes from genuine browser table layout (see pdf.variable-renderer.ts) —
  // there's no formula to mirror client-side without building a second,
  // drift-prone layout engine. Instead: fetch the exact same HTML the
  // Preview modal already fetches (previewDraftHtml), render it in a hidden
  // iframe, and read real element positions back via offsetTop. This is a
  // pure render-time overlay — patchElement/onDragStop/onResizeStop below
  // keep reading/writing each element's real stored x/y, so reflow can never
  // corrupt the saved template JSON.
  const [reflowOffsets, setReflowOffsets] = useState<Record<string, number>>({});
  const [reflowHeights, setReflowHeights] = useState<Record<string, number>>({});
  const [measureHtml, setMeasureHtml] = useState('');
  const measureIframeRef = useRef<HTMLIFrameElement>(null);
  const reflowActive = region === 'body' && liveMode && !!liveDocId;

  useEffect(() => {
    if (!reflowActive) { setReflowOffsets({}); setReflowHeights({}); setMeasureHtml(''); return; }
    const timer = setTimeout(() => {
      previewDraftHtml(MODULE_FOR_DOCTYPE[docType], liveDocId, { elements: bodyElements, page: pageCfg, header, footer })
        .then(setMeasureHtml)
        .catch(() => { /* leave last-known offsets in place on a transient fetch failure */ });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflowActive, docType, liveDocId, JSON.stringify(bodyElements), JSON.stringify(pageCfg), JSON.stringify(header), JSON.stringify(footer)]);

  const handleMeasureLoad = () => {
    const doc = measureIframeRef.current?.contentDocument;
    if (!doc?.body) return;
    // getBoundingClientRect (not offsetTop) — elements sit inside "band"
    // divs that are themselves position:relative, so offsetTop would
    // measure distance to the nearest band wrapper, not the page; a
    // bounding-rect diff against <body> is correct regardless of how many
    // nested bands the template has.
    const bodyTop = doc.body.getBoundingClientRect().top;
    const offsets: Record<string, number> = {};
    const heights: Record<string, number> = {};
    doc.querySelectorAll('[data-el-id]').forEach((node) => {
      const id = node.getAttribute('data-el-id');
      if (!id) return;
      const rect = (node as HTMLElement).getBoundingClientRect();
      offsets[id] = rect.top - bodyTop;
      heights[id] = rect.height;
    });
    setReflowOffsets(offsets);
    setReflowHeights(heights);
  };

  const getReflowOffset = (el: DesignElement): number =>
    reflowActive && reflowOffsets[el.id] != null ? reflowOffsets[el.id] - el.y : 0;

  // Only flow-type elements (table/richtext) can legitimately differ in real
  // height from their design-time box — everything else keeps a fixed box in
  // both the canvas and the real renderer, so resizing it here would just
  // introduce a NEW mismatch. Without this, a flow element whose real content
  // is shorter than its designed box (e.g. an empty Notes/Terms box that
  // collapses to ~0 in the real render) still draws at its full original
  // height on canvas, visually overlapping whatever was correctly
  // repositioned to sit right after it.
  const getReflowHeight = (el: DesignElement): number =>
    reflowActive && FLOW_TYPES.has(el.type) && reflowHeights[el.id] != null ? reflowHeights[el.id] : el.h;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, data: { name: tplName, elements: bodyElements, page: pageCfg, header, footer } });
      } else {
        const res = await createMut.mutateAsync({ name: tplName, docType, elements: bodyElements, page: pageCfg, header, footer });
        const newId = res.data?.data?._id;
        if (newId) navigate(`/native-crm/template-designer?id=${newId}&docType=${docType}`, { replace: true });
      }
      clearDraft(); // saved to the server now — the local autosave draft is no longer needed
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const guideY = CANVAS_H - pageCfg.marginTopPx - pageCfg.marginBottomPx;
  const canvasHeight = region === 'body' ? CANVAS_H : region === 'header' ? headerCfg.heightPx : footerCfg.heightPx;
  const addTypes: ElemType[] = region === 'body'
    ? ['text','image','divider','box','table','totals','richtext']
    : ['text','image','divider','box'];

  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* ── Top toolbar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0 z-10">
        <button onClick={() => { clearDraft(); navigate('/native-crm/settings'); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeftIcon className="h-4 w-4" />Back
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <input
          value={tplName}
          onChange={e => setTplName(e.target.value)}
          className="text-sm font-medium text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-brand-400 focus:outline-none bg-transparent min-w-[180px] px-1 py-0.5"
        />
        <select
          value={docType}
          onChange={e => { setDocType(e.target.value as DocType); setSelectedId(null); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 text-gray-600"
        >
          {DOC_TYPES.map(dt => <option key={dt} value={dt}>{dt.charAt(0).toUpperCase() + dt.slice(1)}</option>)}
        </select>

        <div className="flex items-center gap-1.5 ml-2 text-[10px] text-gray-400">
          <span>Add:</span>
          {addTypes.map(t => (
            <button key={t} onClick={() => addElement(t)}
              className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 capitalize">
              <PlusIcon className="h-3 w-3" />{t}
            </button>
          ))}
          {region === 'body' && (
            <div className="relative" ref={gridPickerRef}>
              <button onClick={() => setShowGridPicker(v => !v)}
                className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                <PlusIcon className="h-3 w-3" />Grid Table
              </button>
              {showGridPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] text-gray-500 mb-1.5 text-center">
                    {gridPickerHover ? `${gridPickerHover.r + 1} × ${gridPickerHover.c + 1}` : 'Pick a size'}
                  </p>
                  <div className="grid grid-cols-8 gap-[3px]" onMouseLeave={() => setGridPickerHover(null)}>
                    {Array.from({ length: 8 * 8 }).map((_, i) => {
                      const r = Math.floor(i / 8), c = i % 8;
                      const active = !!gridPickerHover && r <= gridPickerHover.r && c <= gridPickerHover.c;
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setGridPickerHover({ r, c })}
                          onClick={() => {
                            const el = createGridTableElement(r + 1, c + 1);
                            setElements(prev => [...prev, el]);
                            setSelectedId(el.id);
                            setShowGridPicker(false);
                            setGridPickerHover(null);
                          }}
                          className={`h-3.5 w-3.5 border rounded-sm cursor-pointer ${active ? 'bg-brand-500 border-brand-600' : 'bg-gray-50 border-gray-200'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setLiveMode(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg ${liveMode ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${liveMode ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            Live Data
          </button>
          {liveMode && (
            <select
              value={liveDocId}
              onChange={e => setLiveDocId(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 text-gray-600 max-w-[180px]"
            >
              <option value="">Select a {docType}…</option>
              {docs.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d[ID_FIELD[docType]] ?? d._id}{d.title ? ` — ${d.title}` : ''}
                </option>
              ))}
            </select>
          )}
          {region === 'body' && (
            <>
              <input ref={analysisFileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={handleAnalysisFileChange} />
              <button
                onClick={() => analysisFileInputRef.current?.click()}
                disabled={analyzeMut.isPending}
                title="Upload an existing invoice/quotation/contract/workorder (PDF or image) to auto-generate a draft template"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-60"
              >
                {analyzeMut.isPending ? 'Analyzing…' : 'Analyze existing PDF'}
              </button>
            </>
          )}
          <button onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            <EyeIcon className="h-3.5 w-3.5" />Preview
          </button>
          {editId && (
            <button onClick={() => setDefaultMut.mutate(editId)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50">
              <StarIcon className="h-3.5 w-3.5" />Set as Default
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saved ? <><CheckIcon className="h-4 w-4" />Saved!</> : saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-1.5 flex items-center justify-between text-xs text-red-700 shrink-0">
          <span>{analysisError}</span>
          <button onClick={() => setAnalysisError('')} className="text-red-400 hover:text-red-600"><XMarkIcon className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {analysisWarnings.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between text-xs text-amber-700 shrink-0">
          <span>{analysisWarnings.length} element{analysisWarnings.length > 1 ? 's' : ''} couldn't be placed automatically and {analysisWarnings.length > 1 ? 'were' : 'was'} skipped — add {analysisWarnings.length > 1 ? 'them' : 'it'} manually.</span>
          <button onClick={() => setAnalysisWarnings([])} className="text-amber-400 hover:text-amber-600"><XMarkIcon className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── Region tabs (which element array the canvas below edits) ───────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-1 shrink-0 z-10">
        {(['body', 'header', 'footer'] as const).map(r => (
          <button key={r} onClick={() => { setRegion(r); setSelectedId(null); setShowGridPicker(false); setGridPickerHover(null); }}
            className={`px-3 py-1 text-xs rounded-md capitalize ${region === r ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
            {r}
            {r === 'header' && headerCfg.enabled && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
            {r === 'footer' && footerCfg.enabled && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
          </button>
        ))}
        {region === 'header' && (
          <div className="flex items-center gap-3 ml-3 text-xs text-gray-500">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={headerCfg.enabled} onChange={e => setHeaderCfg(c => ({ ...c, enabled: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
              Repeat on every page
            </label>
            <label className="flex items-center gap-1.5">
              Height (px)
              <input type="number" min={0} max={300} value={headerCfg.heightPx}
                onChange={e => setHeaderCfg(c => ({ ...c, heightPx: +e.target.value }))}
                className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded" />
            </label>
          </div>
        )}
        {region === 'footer' && (
          <div className="flex items-center gap-3 ml-3 text-xs text-gray-500">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={footerCfg.enabled} onChange={e => setFooterCfg(c => ({ ...c, enabled: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600" />
              Repeat on every page
            </label>
            <label className="flex items-center gap-1.5">
              Height (px)
              <input type="number" min={0} max={300} value={footerCfg.heightPx}
                onChange={e => setFooterCfg(c => ({ ...c, heightPx: +e.target.value }))}
                className="w-16 px-1.5 py-1 text-xs border border-gray-200 rounded" />
            </label>
          </div>
        )}
        {region !== 'body' && (
          <span className="ml-3 text-[10px] text-gray-400">
            Repeats on every page of the downloaded/emailed PDF — the on-screen preview shows it once, scroll-pinned, not per simulated page.
          </span>
        )}
      </div>

      {/* ── Three-panel layout ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left — Variable tree ───────────────────────────────────────────────── */}
        <div className="w-56 shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variables</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Drag onto canvas</p>
          </div>

          {/* Uploads — tenant image library, drag onto canvas */}
          <div className="border-b border-gray-100">
            <button
              onClick={() => setOpenGroups(o => ({ ...o, Uploads: !o.Uploads }))}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
            >
              Uploads
              <span className="text-gray-300">{openGroups.Uploads ? '▾' : '▸'}</span>
            </button>
            {openGroups.Uploads && (
              <div className="px-2 pb-2">
                <input ref={assetFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAssetFileChange} />
                <button
                  onClick={() => assetFileInputRef.current?.click()}
                  disabled={uploadAssetMut.isPending}
                  className="w-full mb-2 py-1.5 text-[10px] border border-dashed border-gray-300 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center gap-1"
                >
                  <PlusIcon className="h-3 w-3" />
                  {uploadAssetMut.isPending ? 'Uploading…' : 'Upload Image'}
                </button>
                {uploadError && <p className="text-[9px] text-red-500 mb-2">{uploadError}</p>}
                {assets.length === 0 ? (
                  <p className="text-[9px] text-gray-300 text-center py-2">No uploads yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {assets.map((asset: TemplateAsset) => (
                      <div key={asset._id} className="relative group aspect-square">
                        <img
                          src={asset.url}
                          draggable
                          onDragStart={e => handleAssetDragStart(e, asset.url)}
                          title={asset.filename}
                          className="w-full h-full object-cover rounded border border-gray-200 cursor-grab active:cursor-grabbing bg-gray-50"
                        />
                        <button
                          onClick={() => {
                            setUploadError('');
                            deleteAssetMut.mutate(asset._id, {
                              onError: (err: any) => setUploadError(err?.response?.data?.message ?? 'Delete failed'),
                            });
                          }}
                          title="Delete"
                          className="hidden group-hover:flex absolute -top-1 -right-1 h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 text-[9px] leading-none"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {catalogGroups.map(group => (
            <div key={group.label} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => setOpenGroups(o => ({ ...o, [group.label]: !o[group.label] }))}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
              >
                {group.label}
                <span className="text-gray-300">{openGroups[group.label] ? '▾' : '▸'}</span>
              </button>
              {openGroups[group.label] && (
                <div className="pb-1">
                  {group.items.map(item => (
                    <div
                      key={item.key}
                      draggable
                      onDragStart={e => handleVarDragStart(e, item.key, item.elemType)}
                      className="mx-2 mb-0.5 px-2 py-1.5 rounded text-[10px] text-gray-600 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 cursor-grab active:cursor-grabbing border border-transparent hover:border-brand-200 flex items-center gap-1.5"
                    >
                      <span className="text-[8px] text-gray-300">⠿</span>
                      {item.label}
                      {item.elemType !== 'text' && (
                        <span className="ml-auto text-[8px] text-gray-300 uppercase">{item.elemType}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Page margins */}
          <div className="border-t border-gray-100 px-3 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Page Margins (px)</p>
            <div className="grid grid-cols-2 gap-1">
              <label className="text-[9px] text-gray-400">Top
                <input type="number" min={0} max={200} value={pageCfg.marginTopPx}
                  onChange={e => setPageCfg(p => ({ ...p, marginTopPx: +e.target.value }))}
                  className="w-full px-1.5 py-1 text-[10px] border border-gray-200 rounded" />
              </label>
              <label className="text-[9px] text-gray-400">Bottom
                <input type="number" min={0} max={200} value={pageCfg.marginBottomPx}
                  onChange={e => setPageCfg(p => ({ ...p, marginBottomPx: +e.target.value }))}
                  className="w-full px-1.5 py-1 text-[10px] border border-gray-200 rounded" />
              </label>
            </div>
          </div>

          {/* Saved templates list */}
          {!listLoading && (
            <div className="border-t border-gray-100 mt-2">
              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saved Templates</p>
                <button
                  onClick={async () => {
                    const tpl = await seedStarterMut.mutateAsync(docType);
                    navigate(`/native-crm/template-designer?id=${tpl._id}&docType=${docType}`);
                  }}
                  disabled={seedStarterMut.isPending}
                  title="Add an editable starter template for this document type — safe to click even if one already exists"
                  className="text-[10px] font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {seedStarterMut.isPending ? 'Adding…' : '+ Starter template'}
                </button>
              </div>
              {allTemplates?.map((t: any) => (
                <div key={t._id} className="mx-2 mb-1 px-2 py-1.5 rounded border border-gray-100 bg-gray-50 flex items-center gap-1.5 group">
                  {t.isDefault && <StarSolid className="h-3 w-3 text-amber-400 shrink-0" />}
                  <span className="text-[10px] text-gray-600 truncate flex-1">{t.name}</span>
                  <div className="hidden group-hover:flex gap-1">
                    <button onClick={() => navigate(`/native-crm/template-designer?id=${t._id}&docType=${t.docType}`)}
                      className="p-0.5 text-gray-400 hover:text-brand-600"><DocumentDuplicateIcon className="h-3 w-3" /></button>
                    <button onClick={() => deleteMut.mutate(t._id)}
                      className="p-0.5 text-gray-400 hover:text-red-500"><TrashIcon className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center — Canvas ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center bg-gray-200">
          <div
            ref={canvasRef}
            style={{ width: CANVAS_W, minHeight: canvasHeight, height: region === 'body' ? undefined : canvasHeight, position: 'relative', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.15)', flexShrink: 0 }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onClick={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
          >
            {/* Approximate page-1 break guide (body only — header/footer are single fixed-height bands) */}
            {region === 'body' && guideY > 0 && guideY < CANVAS_H && (
              <div style={{ position: 'absolute', top: guideY, left: 0, right: 0, borderTop: '1px dashed #f59e0b', zIndex: 0, pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', right: 4, top: -14, fontSize: 9, color: '#f59e0b' }}>≈ page break (content above tables)</span>
              </div>
            )}
            {/* Smart alignment guides — pink snap lines, Canva/Figma-style, shown while dragging */}
            {guides.v.map((x, i) => (
              <div key={`gv-${i}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, background: '#ec4899', zIndex: 60, pointerEvents: 'none' }} />
            ))}
            {guides.h.map((y, i) => (
              <div key={`gh-${i}`} style={{ position: 'absolute', top: y, left: 0, right: 0, height: 1, background: '#ec4899', zIndex: 60, pointerEvents: 'none' }} />
            ))}
            {elements.map(el => {
              const reflowOffset = getReflowOffset(el);
              const reflowHeight = getReflowHeight(el);
              const reflowHeightDelta = reflowHeight - el.h;
              return (
              <Rnd
                key={el.id}
                position={{ x: el.x, y: el.y + reflowOffset }}
                size={{ width: el.w, height: reflowHeight }}
                onDrag={(_, d) => {
                  const trueY = d.y - reflowOffset;
                  const snap = computeSnap({ x: d.x, y: trueY, w: el.w, h: el.h }, elements.filter(e => e.id !== el.id), CANVAS_W, canvasHeight);
                  setGuides({ v: snap.vLine !== null ? [snap.vLine] : [], h: snap.hLine !== null ? [snap.hLine + reflowOffset] : [] });
                }}
                onDragStop={(_, d) => {
                  const trueY = d.y - reflowOffset;
                  const snap = computeSnap({ x: d.x, y: trueY, w: el.w, h: el.h }, elements.filter(e => e.id !== el.id), CANVAS_W, canvasHeight);
                  patchElement(el.id, { x: snap.x, y: snap.y });
                  setGuides({ v: [], h: [] });
                }}
                onResizeStop={(_, __, ref, ___, pos) =>
                  patchElement(el.id, { w: parseInt(ref.style.width), h: parseInt(ref.style.height) - reflowHeightDelta, x: pos.x, y: pos.y - reflowOffset })
                }
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedId(el.id); }}
                bounds="parent"
                style={{
                  outline: selectedId === el.id ? '2px solid #6366f1' : '1px dashed transparent',
                  cursor: 'move',
                  zIndex: el.z ?? 1,
                }}
              >
                <div className="relative w-full h-full">
                  <ElementPreview
                    el={el}
                    live={liveMode ? liveData : undefined}
                    selected={selectedId === el.id}
                    onColumnsChange={el.type === 'table' ? (columns) => patchElement(el.id, { columns }) : undefined}
                    onGridChange={el.type === 'gridtable' ? (patch) => patchElement(el.id, patch) : undefined}
                  />
                  {overlapsFlow(el) && (
                    <span title="Overlaps a table/grid/rich-text block — its position here won't match the PDF. Move it clear of that block, or drop it directly inside one of its cells instead."
                      className="absolute -top-2 -right-2 bg-amber-100 border border-amber-300 rounded-full p-0.5">
                      <ExclamationTriangleIcon className="h-3 w-3 text-amber-600" />
                    </span>
                  )}
                </div>
              </Rnd>
              );
            })}
            {elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
                <p className="text-sm font-medium">Empty canvas</p>
                <p className="text-xs mt-1">Drag variables from the left panel or use Add buttons above</p>
              </div>
            )}
            {/* Off-screen — measures the real rendered HTML so the canvas can reflow
                to match Preview/Download exactly (see "Reflow parity" above). */}
            {reflowActive && measureHtml && (
              <iframe
                ref={measureIframeRef}
                srcDoc={measureHtml}
                onLoad={handleMeasureLoad}
                title="reflow-measurement"
                style={{ position: 'absolute', left: -9999, top: 0, width: CANVAS_W, height: 1, border: 0, visibility: 'hidden' }}
              />
            )}
            {/* Drag the bottom edge to resize the header/footer band directly on canvas */}
            {region !== 'body' && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = region === 'header' ? headerCfg.heightPx : footerCfg.heightPx;
                  const setCfg = region === 'header' ? setHeaderCfg : setFooterCfg;
                  const onMove = (ev: MouseEvent) => {
                    const next = Math.round(Math.min(300, Math.max(0, startHeight + (ev.clientY - startY))));
                    setCfg(c => ({ ...c, heightPx: next }));
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
                title="Drag to resize"
                className="absolute left-0 right-0 bottom-0 h-2.5 cursor-ns-resize bg-brand-100 hover:bg-brand-400 flex items-center justify-center transition-colors"
                style={{ zIndex: 70 }}
              >
                <span className="text-[8px] text-brand-600 leading-none">⋯</span>
              </div>
            )}
          </div>
        </div>

        {/* Right — Properties panel ───────────────────────────────────────────── */}
        <div className="w-64 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          {selected ? (
            <PropertiesPanel
              el={selected}
              onChange={patch => patchElement(selected.id, patch)}
              onDelete={() => deleteElement(selected.id)}
            />
          ) : (
            <div className="p-4 text-center text-gray-300">
              <p className="text-xs mt-8">Select an element<br />to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          docType={docType}
          elements={bodyElements}
          page={pageCfg}
          header={header}
          footer={footer}
          docs={docs}
          initialDocId={liveDocId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
