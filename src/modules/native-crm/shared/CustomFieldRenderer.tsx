import { useRef, useState, useMemo } from 'react';
import type { NativeCustomField } from '../queries/custom-fields.queries';
import { useCustomFieldUpload } from '../queries/custom-fields.queries';
import type { IFormField } from '../queries/custom-form-templates.queries';
import { COUNTRIES, CURRENCIES, getCountry, getCurrency } from './phone-currency-data';

interface CustomFieldRendererProps {
  field:           NativeCustomField;
  value:           any;
  onChange:        (val: any) => void;
  templateFields?: IFormField[];
}

// ── Cascade / formula helpers ─────────────────────────────────────────────────
function isVisible(f: IFormField, subForm: Record<string, any>): boolean {
  if (!f.parentKey) return true;
  const parentVal = subForm[f.parentKey];
  if (!parentVal) return false;
  if (!f.parentValues?.length) return true;
  return f.parentValues.includes(String(parentVal));
}

function evalFormula(formula: string, subForm: Record<string, any>): string {
  try {
    const expr = formula.replace(/\{(\w+)\}/g, (_, k) => {
      const v = subForm[k];
      if (v === null || v === undefined) return '0';
      // currency objects: extract amount
      if (typeof v === 'object' && !Array.isArray(v) && 'amount' in v) return String((v as any).amount ?? 0);
      return String(v ?? 0);
    });
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${expr})`)();
    return String(result);
  } catch { return '—'; }
}

// ── Phone field with country code ─────────────────────────────────────────────
function PhoneSubField({ field, val, setSub }: { field: IFormField; val: any; setSub: (k: string, v: any) => void }) {
  const stored = String(val ?? '');
  // Try to find the dial code in the stored value
  const matchedCountry = COUNTRIES.find((c) => stored.startsWith(c.dial + ' '));
  const defaultCode = field.formula || 'IN';
  const [selected, setSelected] = useState(matchedCountry?.code ?? defaultCode);
  const country = getCountry(selected);
  const numberPart = stored.startsWith(country.dial + ' ') ? stored.slice(country.dial.length + 1) : stored.replace(/^\+\d+\s*/, '');

  const commit = (code: string, num: string) => {
    const c = getCountry(code);
    setSub(field.key, num ? `${c.dial} ${num}` : '');
  };

  const SEL = 'rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200';
  const INP = 'flex-1 min-w-0 rounded-r-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="flex">
      <select value={selected} onChange={(e) => { setSelected(e.target.value); commit(e.target.value, numberPart); }} className={SEL}>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
        ))}
      </select>
      <input type="tel" value={numberPart} placeholder="Phone number"
        onChange={(e) => commit(selected, e.target.value)} className={INP} />
    </div>
  );
}

// ── Currency field with symbol ────────────────────────────────────────────────
function CurrencySubField({ field, val, setSub }: { field: IFormField; val: any; setSub: (k: string, v: any) => void }) {
  const defaultCode = field.formula || 'USD';
  const storedCode = typeof val === 'object' && val !== null ? (val as any).code ?? defaultCode : defaultCode;
  const storedAmt  = typeof val === 'object' && val !== null ? (val as any).amount ?? '' : (typeof val === 'number' ? val : '');
  const [selected, setSelected] = useState<string>(storedCode);
  const currency = getCurrency(selected);

  const commit = (code: string, amount: string) => {
    setSub(field.key, { code, amount: amount !== '' ? parseFloat(amount) || 0 : '' });
  };

  const SEL = 'rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 max-w-[110px]';
  const INP = 'flex-1 min-w-0 rounded-r-lg border border-gray-300 pl-6 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="flex">
      <select value={selected} onChange={(e) => { setSelected(e.target.value); commit(e.target.value, String(storedAmt)); }} className={SEL}>
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
        ))}
      </select>
      <div className="relative flex-1 min-w-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none select-none">
          {currency.symbol}
        </span>
        <input type="number" min="0" step="0.01"
          value={storedAmt === '' ? '' : storedAmt}
          onChange={(e) => commit(selected, e.target.value)}
          placeholder="0.00"
          className={INP}
        />
      </div>
    </div>
  );
}

// ── Cascade dropdown (two-level linked selects) ───────────────────────────────
function CascadeDropdownSubField({ field, val, setSub }: {
  field: IFormField; val: any; setSub: (k: string, v: any) => void;
}) {
  const tree: Record<string, Record<string, object>> = useMemo(() => {
    try { return JSON.parse(field.formula || '{}') as Record<string, Record<string, object>>; } catch { return {}; }
  }, [field.formula]);

  const selected: string[] = Array.isArray(val) ? val : [];
  const l1 = selected[0] ?? '';
  const l2Options = l1 ? Object.keys(tree[l1] ?? {}) : [];

  const SEL = 'flex-1 min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 bg-white';

  return (
    <div className="flex flex-wrap gap-2">
      <select value={l1} onChange={(e) => setSub(field.key, e.target.value ? [e.target.value] : [])} className={SEL}>
        <option value="">— Select —</option>
        {Object.keys(tree).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      {l2Options.length > 0 && (
        <select value={selected[1] ?? ''} onChange={(e) => setSub(field.key, e.target.value ? [l1, e.target.value] : [l1])} className={SEL}>
          <option value="">— Select sub —</option>
          {l2Options.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Table field (user-defined columns + repeating rows) ───────────────────────
interface TableColDef {
  key:      string;
  label:    string;
  type:     'text' | 'number' | 'dropdown' | 'formula';
  options?: string[];
  formula?: string;
}

function TableSubField({ field, val, setSub }: {
  field: IFormField; val: any; setSub: (k: string, v: any) => void;
}) {
  const cols: TableColDef[] = useMemo(() => {
    try { return JSON.parse(field.formula || '[]') as TableColDef[]; } catch { return []; }
  }, [field.formula]);

  const rows: Record<string, any>[] = Array.isArray(val) ? val : [];
  const setRows = (r: Record<string, any>[]) => setSub(field.key, r);
  const addRow  = () => setRows([...rows, {}]);
  const delRow  = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const setCell = (ri: number, colKey: string, v: any) =>
    setRows(rows.map((r, j) => j === ri ? { ...r, [colKey]: v } : r));

  const evalCol = (formula: string, row: Record<string, any>) => {
    try {
      const expr = formula.replace(/\{(\w+)\}/g, (_, k) => String(row[k] ?? 0));
      // eslint-disable-next-line no-new-func
      return String(new Function(`return (${expr})`)());
    } catch { return '—'; }
  };

  if (cols.length === 0) {
    return <p className="text-xs text-gray-400 italic">No columns defined — configure the template first.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {c.label}{c.type === 'formula' && <span className="ml-1 text-emerald-500">fx</span>}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 last:border-0">
              {cols.map((col) => {
                const cellVal = row[col.key] ?? '';
                if (col.type === 'formula') {
                  return (
                    <td key={col.key} className="px-3 py-2">
                      <span className="font-mono text-emerald-700 font-semibold">{evalCol(col.formula ?? '', row)}</span>
                    </td>
                  );
                }
                return (
                  <td key={col.key} className="px-3 py-1.5">
                    {col.type === 'dropdown' ? (
                      <select value={cellVal} onChange={(e) => setCell(ri, col.key, e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800">
                        <option value="">— Select —</option>
                        {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={cellVal}
                        onChange={(e) => setCell(ri, col.key, col.type === 'number' ? (parseFloat(e.target.value) || '') : e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800"
                      />
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-1.5">
                <button type="button" onClick={() => delRow(ri)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 1} className="px-4 py-6 text-center text-xs text-gray-400 italic">
                No rows yet — click Add Row
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-gray-100">
        <button type="button" onClick={addRow}
          className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1">
          + Add Row
        </button>
      </div>
    </div>
  );
}

// ── Inline sub-form (custom_form type) ────────────────────────────────────────
function CustomSubForm({ templateFields, value, onChange }: {
  templateFields: IFormField[];
  value:    Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const sub    = value ?? {};
  const sorted = [...templateFields].sort((a, b) => a.order - b.order);
  const setSub = (key: string, val: any) => onChange({ ...sub, [key]: val });

  const SUB = 'w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className="space-y-3 p-4 rounded-xl bg-purple-50 border border-purple-100">
      {sorted.filter((f) => isVisible(f, sub)).map((f) => {
        const val = sub[f.key];
        if (f.fieldType === 'formula') {
          return (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {f.label} <span className="text-gray-400 font-normal">(computed)</span>
              </label>
              <div className="px-2.5 py-1.5 bg-white border border-gray-200 rounded text-sm font-semibold text-brand-700">
                {evalFormula(f.formula ?? '', sub)}
              </div>
            </div>
          );
        }
        return (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-400">
              {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {f.fieldType === 'cascade_dropdown' ? (
              <CascadeDropdownSubField field={f} val={val} setSub={setSub} />
            ) : f.fieldType === 'table' ? (
              <TableSubField field={f} val={val} setSub={setSub} />
            ) : f.fieldType === 'phone' ? (
              <PhoneSubField field={f} val={val} setSub={setSub} />
            ) : f.fieldType === 'currency' ? (
              <CurrencySubField field={f} val={val} setSub={setSub} />
            ) : f.fieldType === 'textarea' ? (
              <textarea rows={2} value={val ?? ''} onChange={(e) => setSub(f.key, e.target.value)} className={`${SUB} resize-none`} />
            ) : f.fieldType === 'radio' ? (
              <div className="space-y-1.5">
                {(f.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name={f.key} value={o} checked={val === o}
                      onChange={() => setSub(f.key, o)} className="h-4 w-4 accent-brand-600" />
                    {o}
                  </label>
                ))}
              </div>
            ) : f.fieldType === 'multi_select' ? (
              <div className="space-y-1.5">
                {(f.options ?? []).map((o) => {
                  const cur = Array.isArray(val) ? val as string[] : [];
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={cur.includes(o)}
                        onChange={() => setSub(f.key, cur.includes(o) ? cur.filter((x: string) => x !== o) : [...cur, o])}
                        className="h-4 w-4 rounded accent-brand-600" />
                      {o}
                    </label>
                  );
                })}
              </div>
            ) : f.fieldType === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!val} onChange={(e) => setSub(f.key, e.target.checked)}
                  className="h-4 w-4 rounded" />
                <span className="text-sm">Yes</span>
              </label>
            ) : f.fieldType === 'rating' ? (
              <div className="flex gap-1">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} type="button" onClick={() => setSub(f.key, s)}
                    className={`text-xl transition-colors ${Number(val) >= s ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>★</button>
                ))}
              </div>
            ) : f.fieldType === 'dropdown' ? (
              <select value={val ?? ''} onChange={(e) => setSub(f.key, e.target.value)} className={SUB}>
                <option value="">Select…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.fieldType === 'url' ? (
              <input type="url" value={val ?? ''} onChange={(e) => setSub(f.key, e.target.value)} className={SUB} />
            ) : f.fieldType === 'time' ? (
              <input type="time" value={val ?? ''} onChange={(e) => setSub(f.key, e.target.value)} className={SUB} />
            ) : f.fieldType === 'datetime' ? (
              <input type="datetime-local" value={val ? String(val).slice(0, 16) : ''} onChange={(e) => setSub(f.key, e.target.value)} className={SUB} />
            ) : (
              <input
                type={f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : f.fieldType === 'email' ? 'email' : 'text'}
                value={val ?? ''}
                onChange={(e) => setSub(f.key, e.target.value)}
                className={SUB}
              />
            )}
          </div>
        );
      })}
      {sorted.filter((f) => isVisible(f, sub)).length === 0 && (
        <p className="text-xs text-gray-400">No fields visible — fill in parent fields to reveal sub-fields.</p>
      )}
    </div>
  );
}

const BASE_CLS = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

// ── Upload button (handles image OR video) ────────────────────────────────────
function UploadButton({
  accept, multiple, onUpload, label, disabled, mediaType, maxSizeMB,
}: {
  accept:     string;
  multiple:   boolean;
  onUpload:   (urls: string[]) => void;
  label:      string;
  disabled?:  boolean;
  mediaType:  'image' | 'video';
  maxSizeMB:  number;
}) {
  const ref    = useRef<HTMLInputElement>(null);
  const upload = useCustomFieldUpload(mediaType);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const fileList = Array.from(e.target.files ?? []);
    if (!fileList.length) return;

    // Client-side size validation
    const maxBytes = maxSizeMB * 1024 * 1024;
    const tooLarge = fileList.filter((f) => f.size > maxBytes);
    if (tooLarge.length > 0) {
      setError(`File too large. Maximum size: ${maxSizeMB} MB per file.`);
      if (ref.current) ref.current.value = '';
      return;
    }

    const fd = new FormData();
    if (multiple) fileList.forEach((f) => fd.append('files', f));
    else fd.append('file', fileList[0]);

    try {
      const res = await upload.mutateAsync(fd);
      onUpload(res.urls ?? (res.url ? [res.url] : []));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Upload failed';
      setError(msg);
    }
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => { setError(null); ref.current?.click(); }}
        disabled={disabled || upload.isPending}
        className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50 dark:border-gray-600 dark:text-gray-400"
      >
        {upload.isPending ? (
          <span className="flex items-center gap-1.5">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Uploading…
          </span>
        ) : (
          <>
            {mediaType === 'video' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
              </svg>
            )}
            {label}
            <span className="text-xs text-gray-400 ml-1">(max {maxSizeMB} MB)</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </p>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────
export default function CustomFieldRenderer({ field, value, onChange, templateFields }: CustomFieldRendererProps) {
  switch (field.fieldType) {

    case 'custom_form':
      if (!templateFields?.length) {
        return <p className="text-xs text-gray-400 italic">No form template attached.</p>;
      }
      return (
        <CustomSubForm
          templateFields={templateFields}
          value={typeof value === 'object' && value !== null ? value : {}}
          onChange={onChange}
        />
      );

    // ── Text types ────────────────────────────────────────────────────────────
    case 'textarea':
      return (
        <textarea
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${BASE_CLS} resize-none`}
        />
      );

    case 'dropdown':
    case 'radio': {
      const opts = field.options ?? [];
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={BASE_CLS}>
          <option value="">Select…</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'multi_select': {
      const opts    = field.options ?? [];
      const current = Array.isArray(value) ? value : [];
      const toggle  = (opt: string) => {
        const next = current.includes(opt) ? current.filter((v: string) => v !== opt) : [...current, opt];
        onChange(next);
      };
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => (
            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={current.includes(o)}
                onChange={() => toggle(o)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
              />
              {o}
            </label>
          ))}
        </div>
      );
    }

    case 'boolean':
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
        </label>
      );

    case 'date':
      return (
        <input
          type="date"
          value={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={BASE_CLS}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={BASE_CLS}
        />
      );

    case 'number':
    case 'currency':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          step={field.fieldType === 'currency' ? '0.01' : '1'}
          min="0"
          className={BASE_CLS}
        />
      );

    case 'email':
      return <input type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={BASE_CLS} />;

    case 'phone':
      return <input type="tel" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={BASE_CLS} />;

    case 'url':
      return <input type="url" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={BASE_CLS} />;

    case 'rating': {
      const stars = [1, 2, 3, 4, 5];
      return (
        <div className="flex gap-1">
          {stars.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`text-xl ${Number(value) >= s ? 'text-amber-400' : 'text-gray-300'} hover:text-amber-400 transition-colors`}
            >
              ★
            </button>
          ))}
        </div>
      );
    }

    // ── Single image ──────────────────────────────────────────────────────────
    case 'image': {
      const url = value as string | undefined;
      const isPdf = url?.toLowerCase().endsWith('.pdf');
      
      return (
        <div className="space-y-2">
          {url && (
            <div className="relative inline-block w-full">
              {isPdf ? (
                 <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center w-full h-32 rounded-lg border border-gray-200 shadow-sm bg-gray-50 hover:bg-brand-50 hover:border-brand-300 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 mb-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">View PDF Document</span>
                 </a>
              ) : (
                <img
                  src={url}
                  alt="upload"
                  className="h-32 w-32 rounded-lg object-cover border border-gray-200 shadow-sm"
                />
              )}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onChange(''); }}
                className={`absolute ${isPdf ? '-top-2 -right-2' : '-top-1.5 left-[120px]'} h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 shadow-md z-10`}
              >
                ×
              </button>
            </div>
          )}
          <UploadButton
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
            multiple={false}
            mediaType="image"
            maxSizeMB={5}
            onUpload={(urls) => onChange(urls[0] ?? '')}
            label={url ? 'Replace file' : 'Upload file'}
          />
          <p className="text-xs text-gray-400">Supported: JPG, PNG, GIF, WEBP, SVG, PDF</p>
        </div>
      );
    }

    // ── Multiple images ───────────────────────────────────────────────────────
    case 'images': {
      const urls = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {urls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {urls.map((u, i) => {
                const isPdf = u.toLowerCase().endsWith('.pdf');
                return (
                  <div key={i} className="relative group w-24 h-24 shrink-0">
                    {isPdf ? (
                       <a href={u} target="_blank" rel="noopener noreferrer" className="h-full w-full rounded-lg border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center hover:border-brand-300 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          <span className="text-[10px] text-gray-600 font-medium text-center leading-tight">View PDF</span>
                       </a>
                    ) : (
                      <img
                        src={u}
                        alt={`img-${i}`}
                        className="h-full w-full rounded-lg object-cover border border-gray-200 shadow-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onChange(urls.filter((_, j) => j !== i))}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <UploadButton
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
            multiple={true}
            mediaType="image"
            maxSizeMB={5}
            onUpload={(newUrls) => onChange([...urls, ...newUrls])}
            label="Add files"
          />
          <p className="text-xs text-gray-400">Supported: JPG, PNG, GIF, WEBP, SVG, PDF · Max 5 MB each · Up to 20 files</p>
        </div>
      );
    }

    // ── Single video ──────────────────────────────────────────────────────────
    case 'video': {
      const url = value as string | undefined;
      return (
        <div className="space-y-2">
          {url && (
            <div className="relative">
              <video
                src={url}
                controls
                className="w-full max-h-48 rounded-lg border border-gray-200 bg-black shadow-sm"
              />
              <button
                type="button"
                onClick={() => onChange('')}
                className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove video
              </button>
            </div>
          )}
          <UploadButton
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            multiple={false}
            mediaType="video"
            maxSizeMB={10}
            onUpload={(urls) => onChange(urls[0] ?? '')}
            label={url ? 'Replace video' : 'Upload video'}
          />
          <p className="text-xs text-gray-400">Supported: MP4, WEBM, MOV, OGG · Max 10 MB</p>
        </div>
      );
    }

    // ── Multiple videos ───────────────────────────────────────────────────────
    case 'videos': {
      const urls = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-3">
          {urls.length > 0 && (
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 bg-black shadow-sm">
                  <video src={u} controls className="w-full max-h-36" />
                  <button
                    type="button"
                    onClick={() => onChange(urls.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <UploadButton
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            multiple={true}
            mediaType="video"
            maxSizeMB={10}
            onUpload={(newUrls) => onChange([...urls, ...newUrls])}
            label="Add videos"
          />
          <p className="text-xs text-gray-400">Supported: MP4, WEBM, MOV, OGG · Max 10 MB each · Up to 5 files</p>
        </div>
      );
    }

    // ── Default (text) ────────────────────────────────────────────────────────
    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={BASE_CLS}
        />
      );
  }
}
