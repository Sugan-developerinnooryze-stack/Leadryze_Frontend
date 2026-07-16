import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  ArrowLeftIcon, CheckIcon, PlusIcon, TrashIcon,
  StarIcon, DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import {
  useCustomTemplatesQuery,
  useCustomTemplateCreate,
  useCustomTemplateUpdate,
  useCustomTemplateDelete,
  useCustomTemplateSetDefault,
} from '../../../modules/native-crm/queries/custom-templates.queries';

// ── Types ────────────────────────────────────────────────────────────────────

type ElemType = 'text' | 'image' | 'table' | 'divider' | 'box';

interface DesignElement {
  id:              string;
  type:            ElemType;
  x:               number;
  y:               number;
  w:               number;
  h:               number;
  content?:        string;
  fontSize?:       number;
  fontWeight?:     'normal' | 'bold';
  fontStyle?:      'normal' | 'italic';
  color?:          string;
  textAlign?:      'left' | 'center' | 'right';
  src?:            string;
  backgroundColor?: string;
  borderColor?:    string;
  borderWidth?:    number;
}

// ── Variable tree ─────────────────────────────────────────────────────────────

const VARIABLE_GROUPS = [
  {
    label: 'Company',
    items: [
      { label: 'Company Name',    variable: '{{company.name}}',    type: 'text'  as ElemType },
      { label: 'Company Logo',    variable: '{{company.logo}}',    type: 'image' as ElemType },
      { label: 'Address',         variable: '{{company.address}}', type: 'text'  as ElemType },
      { label: 'GSTIN / Tax ID',  variable: '{{company.gstin}}',   type: 'text'  as ElemType },
      { label: 'Email',           variable: '{{company.email}}',   type: 'text'  as ElemType },
      { label: 'Phone',           variable: '{{company.phone}}',   type: 'text'  as ElemType },
    ],
  },
  {
    label: 'Customer',
    items: [
      { label: 'Customer Name',   variable: '{{customer.name}}',    type: 'text' as ElemType },
      { label: 'Email',           variable: '{{customer.email}}',   type: 'text' as ElemType },
      { label: 'Phone',           variable: '{{customer.phone}}',   type: 'text' as ElemType },
      { label: 'Address',         variable: '{{customer.address}}', type: 'text' as ElemType },
    ],
  },
  {
    label: 'Document',
    items: [
      { label: 'Document ID',     variable: '{{doc.id}}',       type: 'text' as ElemType },
      { label: 'Date',            variable: '{{doc.date}}',     type: 'text' as ElemType },
      { label: 'Due / Valid Date',variable: '{{doc.dueDate}}',  type: 'text' as ElemType },
      { label: 'Status',          variable: '{{doc.status}}',   type: 'text' as ElemType },
      { label: 'Total',           variable: '{{doc.total}}',    type: 'text' as ElemType },
      { label: 'Subtotal',        variable: '{{doc.subtotal}}', type: 'text' as ElemType },
      { label: 'Discount',        variable: '{{doc.discount}}', type: 'text' as ElemType },
      { label: 'GST Rate',        variable: '{{doc.gst}}',      type: 'text' as ElemType },
    ],
  },
  {
    label: 'Services',
    items: [
      { label: 'Services Table',  variable: '{{services.table}}', type: 'table' as ElemType },
    ],
  },
  {
    label: 'Bank Details',
    items: [
      { label: 'Bank Name',       variable: '{{bank.name}}',    type: 'text' as ElemType },
      { label: 'Account Number',  variable: '{{bank.account}}', type: 'text' as ElemType },
      { label: 'BSB / IFSC',      variable: '{{bank.ifsc}}',    type: 'text' as ElemType },
      { label: 'UPI ID',          variable: '{{bank.upi}}',     type: 'text' as ElemType },
    ],
  },
];

const DOC_TYPES = ['invoice', 'quotation', 'contract', 'workorder'] as const;

// A4 canvas dimensions in px (1mm = 3.7795px; 210mm × 297mm)
const CANVAS_W = 794;
const CANVAS_H = 1123;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultForType(type: ElemType, variable?: string): Partial<DesignElement> {
  switch (type) {
    case 'text':    return { content: variable ?? 'Text', fontSize: 13, fontWeight: 'normal', fontStyle: 'normal', color: '#111827', textAlign: 'left' };
    case 'image':   return { src: variable ?? '{{company.logo}}' };
    case 'table':   return {};
    case 'divider': return { borderColor: '#e5e7eb', borderWidth: 1 };
    case 'box':     return { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1 };
  }
}

function defaultSize(type: ElemType): { w: number; h: number } {
  switch (type) {
    case 'text':    return { w: 200, h: 30  };
    case 'image':   return { w: 120, h: 60  };
    case 'table':   return { w: 720, h: 200 };
    case 'divider': return { w: 720, h: 4   };
    case 'box':     return { w: 200, h: 80  };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ElementPreview({ el }: { el: DesignElement }) {
  if (el.type === 'divider') {
    return <div style={{ width: '100%', height: '100%', borderTop: `${el.borderWidth ?? 1}px solid ${el.borderColor ?? '#e5e7eb'}` }} />;
  }
  if (el.type === 'box') {
    return <div style={{ width: '100%', height: '100%', background: el.backgroundColor ?? '#f3f4f6', border: `${el.borderWidth ?? 1}px solid ${el.borderColor ?? '#e5e7eb'}`, borderRadius: 3 }} />;
  }
  if (el.type === 'image') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400 rounded">
        {el.src ?? '{{company.logo}}'}
      </div>
    );
  }
  if (el.type === 'table') {
    return (
      <div className="w-full h-full bg-gray-50 border border-gray-200 rounded text-xs text-gray-400 flex items-center justify-center">
        Services Table
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize:   el.fontSize ?? 13,
        fontWeight: el.fontWeight ?? 'normal',
        fontStyle:  el.fontStyle ?? 'normal',
        color:      el.color ?? '#111827',
        textAlign:  (el.textAlign as any) ?? 'left',
        width: '100%', height: '100%',
        overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}
    >
      {el.content ?? ''}
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

      {(el.type === 'text') && (<>
        {inp('Content', (
          <textarea className={`${cls} resize-none`} rows={3} value={el.content ?? ''} onChange={e => onChange({ content: e.target.value })} />
        ))}
        {inp('Font Size', (
          <input className={cls} type="number" min={8} max={72} value={el.fontSize ?? 13} onChange={e => onChange({ fontSize: +e.target.value })} />
        ))}
        {inp('Font Weight', (
          <select className={cls} value={el.fontWeight ?? 'normal'} onChange={e => onChange({ fontWeight: e.target.value as any })}>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        ))}
        {inp('Font Style', (
          <select className={cls} value={el.fontStyle ?? 'normal'} onChange={e => onChange({ fontStyle: e.target.value as any })}>
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        ))}
        {inp('Color', (
          <div className="flex gap-2 items-center">
            <input type="color" value={el.color ?? '#111827'} onChange={e => onChange({ color: e.target.value })} className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5" />
            <input className={`${cls} flex-1`} value={el.color ?? '#111827'} onChange={e => onChange({ color: e.target.value })} />
          </div>
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

      {(el.type === 'image') && inp('Source variable', (
        <input className={cls} value={el.src ?? ''} onChange={e => onChange({ src: e.target.value })} placeholder="{{company.logo}}" />
      ))}

      {(el.type === 'box' || el.type === 'divider') && (<>
        {el.type === 'box' && inp('Background', (
          <div className="flex gap-2 items-center">
            <input type="color" value={el.backgroundColor ?? '#f3f4f6'} onChange={e => onChange({ backgroundColor: e.target.value })} className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5" />
            <input className={`${cls} flex-1`} value={el.backgroundColor ?? '#f3f4f6'} onChange={e => onChange({ backgroundColor: e.target.value })} />
          </div>
        ))}
        {inp('Border Color', (
          <div className="flex gap-2 items-center">
            <input type="color" value={el.borderColor ?? '#e5e7eb'} onChange={e => onChange({ borderColor: e.target.value })} className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5" />
            <input className={`${cls} flex-1`} value={el.borderColor ?? '#e5e7eb'} onChange={e => onChange({ borderColor: e.target.value })} />
          </div>
        ))}
        {inp('Border Width', (
          <input className={cls} type="number" min={0} max={20} value={el.borderWidth ?? 1} onChange={e => onChange({ borderWidth: +e.target.value })} />
        ))}
      </>)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TemplateDesignerPage() {
  const navigate             = useNavigate();
  const [params]             = useSearchParams();
  const initDocType          = (params.get('docType') ?? 'invoice') as typeof DOC_TYPES[number];
  const editId               = params.get('id') ?? '';

  const [docType,   setDocType]   = useState<typeof DOC_TYPES[number]>(initDocType);
  const [tplName,   setTplName]   = useState('Untitled Template');
  const [elements,  setElements]  = useState<DesignElement[]>([]);
  const [selectedId,setSelectedId]= useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [openGroups,setOpenGroups]= useState<Record<string, boolean>>({ Company: true });

  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: allTemplates, isLoading: listLoading } = useCustomTemplatesQuery(docType);
  const createMut     = useCustomTemplateCreate();
  const updateMut     = useCustomTemplateUpdate();
  const deleteMut     = useCustomTemplateDelete();
  const setDefaultMut = useCustomTemplateSetDefault();

  const selected = elements.find(e => e.id === selectedId) ?? null;

  // Load template into canvas when allTemplates arrives and editId is set
  const loadedRef = useRef<string>('');
  useEffect(() => {
    if (!editId) return;
    if (loadedRef.current === editId) return;
    const tpl = allTemplates?.find((t: any) => t._id === editId);
    if (!tpl) return;
    loadedRef.current = editId;
    setTplName(tpl.name);
    setDocType(tpl.docType);
    setElements(tpl.elements ?? []);
  }, [editId, allTemplates]);

  // ── Drag from variable tree ─────────────────────────────────────────────────
  const handleVarDragStart = (e: React.DragEvent, variable: string, type: ElemType) => {
    e.dataTransfer.setData('variable', variable);
    e.dataTransfer.setData('elemType', type);
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const variable = e.dataTransfer.getData('variable');
    const type     = e.dataTransfer.getData('elemType') as ElemType;
    if (!variable || !type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const size = defaultSize(type);
    const el: DesignElement = {
      id: uid(), type, x, y, ...size,
      ...defaultForType(type, variable),
    };
    if (type === 'text') el.content = variable;
    if (type === 'image') el.src = variable;
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }, []);

  // ── Add blank element ───────────────────────────────────────────────────────
  const addElement = (type: ElemType) => {
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

  // ── Element mutations ────────────────────────────────────────────────────────
  const patchElement = (id: string, patch: Partial<DesignElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, data: { name: tplName, elements } });
      } else {
        const res = await createMut.mutateAsync({ name: tplName, docType, elements });
        const newId = res.data?.data?._id;
        if (newId) navigate(`/native-crm/template-designer?id=${newId}&docType=${docType}`, { replace: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* ── Top toolbar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0 z-10">
        <button onClick={() => navigate('/native-crm/settings')}
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
          onChange={e => { setDocType(e.target.value as any); setSelectedId(null); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 text-gray-600"
        >
          {DOC_TYPES.map(dt => <option key={dt} value={dt}>{dt.charAt(0).toUpperCase() + dt.slice(1)}</option>)}
        </select>

        <div className="flex items-center gap-1.5 ml-2 text-[10px] text-gray-400">
          <span>Add:</span>
          {(['text','image','divider','box'] as ElemType[]).map(t => (
            <button key={t} onClick={() => addElement(t)}
              className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 capitalize">
              <PlusIcon className="h-3 w-3" />{t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
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

      {/* ── Three-panel layout ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left — Variable tree ───────────────────────────────────────────────── */}
        <div className="w-56 shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variables</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Drag onto canvas</p>
          </div>
          {VARIABLE_GROUPS.map(group => (
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
                      key={item.variable}
                      draggable
                      onDragStart={e => handleVarDragStart(e, item.variable, item.type)}
                      className="mx-2 mb-0.5 px-2 py-1.5 rounded text-[10px] text-gray-600 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 cursor-grab active:cursor-grabbing border border-transparent hover:border-brand-200 flex items-center gap-1.5"
                    >
                      <span className="text-[8px] text-gray-300">⠿</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Saved templates list */}
          {!listLoading && allTemplates && allTemplates.length > 0 && (
            <div className="border-t border-gray-100 mt-2">
              <div className="px-3 py-2.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saved Templates</p>
              </div>
              {allTemplates.map((t: any) => (
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
            style={{ width: CANVAS_W, minHeight: CANVAS_H, position: 'relative', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.15)', flexShrink: 0 }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onClick={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
          >
            {elements.map(el => (
              <Rnd
                key={el.id}
                position={{ x: el.x, y: el.y }}
                size={{ width: el.w, height: el.h }}
                onDragStop={(_, d) => patchElement(el.id, { x: d.x, y: d.y })}
                onResizeStop={(_, __, ref, ___, pos) =>
                  patchElement(el.id, { w: parseInt(ref.style.width), h: parseInt(ref.style.height), x: pos.x, y: pos.y })
                }
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedId(el.id); }}
                bounds="parent"
                style={{
                  outline: selectedId === el.id ? '2px solid #6366f1' : '1px dashed transparent',
                  cursor: 'move',
                }}
              >
                <ElementPreview el={el} />
              </Rnd>
            ))}
            {elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
                <p className="text-sm font-medium">Empty canvas</p>
                <p className="text-xs mt-1">Drag variables from the left panel or use Add buttons above</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — Properties panel ───────────────────────────────────────────── */}
        <div className="w-56 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
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
    </div>
  );
}
