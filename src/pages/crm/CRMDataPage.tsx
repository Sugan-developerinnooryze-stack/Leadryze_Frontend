import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { FC, SVGProps } from 'react';
import {
  MagnifyingGlassIcon, AdjustmentsHorizontalIcon, XMarkIcon,
  BuildingOffice2Icon, BriefcaseIcon, ClipboardDocumentListIcon,
  CalendarDaysIcon, PhoneIcon, UserGroupIcon, UserPlusIcon, CubeIcon,
  TruckIcon, TagIcon, ReceiptPercentIcon, DocumentIcon, ShoppingCartIcon,
  ShoppingBagIcon, LifebuoyIcon, LightBulbIcon, BoltIcon,
  CreditCardIcon, ArrowPathIcon, PaperClipIcon, TableCellsIcon,
  Squares2X2Icon, BuildingStorefrontIcon, GlobeAltIcon, EnvelopeIcon,
  CurrencyDollarIcon, ChartPieIcon, FolderIcon, StarIcon,
  WrenchScrewdriverIcon, ChartBarIcon, MegaphoneIcon, DocumentTextIcon,
  UsersIcon, PencilSquareIcon, TrashIcon, PlusIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { usePermission } from '../../hooks/usePermission';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

const MODULE_ICON_MAP: Record<string, HeroIcon> = {
  Accounts: BuildingOffice2Icon, Companies: BuildingOffice2Icon,
  Contacts: UserGroupIcon, Leads: UserPlusIcon,
  Deals: BriefcaseIcon, Potentials: BriefcaseIcon, Opportunities: BriefcaseIcon,
  Tasks: ClipboardDocumentListIcon, Meetings: CalendarDaysIcon, Events: CalendarDaysIcon,
  Calls: PhoneIcon, Activities: BoltIcon, Campaigns: MegaphoneIcon,
  Notes: DocumentTextIcon, Attachments: PaperClipIcon, Documents: FolderIcon, Files: FolderIcon,
  Products: CubeIcon, Vendors: TruckIcon, PriceBooks: TagIcon, Quotes: ReceiptPercentIcon,
  Invoices: DocumentIcon, SalesOrders: ShoppingCartIcon, PurchaseOrders: ShoppingBagIcon,
  Orders: ShoppingCartIcon, Cases: LifebuoyIcon, Tickets: LifebuoyIcon,
  Solutions: LightBulbIcon, Reports: ChartBarIcon, Analytics: ChartPieIcon,
  Dashboards: Squares2X2Icon, Payments: CreditCardIcon, Revenue: CurrencyDollarIcon,
  Subscriptions: ArrowPathIcon, Users: UsersIcon, Customers: UsersIcon,
  Members: UsersIcon, Partners: BuildingStorefrontIcon, Competitors: StarIcon,
  Integrations: WrenchScrewdriverIcon, Webforms: GlobeAltIcon, EmailTemplates: EnvelopeIcon,
};

function getModuleIcon(name: string): HeroIcon {
  if (MODULE_ICON_MAP[name]) return MODULE_ICON_MAP[name];
  const n = name.toLowerCase();
  if (/account|company|org/i.test(n))             return BuildingOffice2Icon;
  if (/deal|opportunit|pipeline/i.test(n))        return BriefcaseIcon;
  if (/task|todo|action/i.test(n))                return ClipboardDocumentListIcon;
  if (/meet|event|calendar/i.test(n))             return CalendarDaysIcon;
  if (/call|phone|dial/i.test(n))                 return PhoneIcon;
  if (/note|comment|memo/i.test(n))               return DocumentTextIcon;
  if (/campaign|market/i.test(n))                 return MegaphoneIcon;
  if (/product|item|catalog/i.test(n))            return CubeIcon;
  if (/invoice|bill|receipt/i.test(n))            return DocumentIcon;
  if (/order|purchase/i.test(n))                  return ShoppingCartIcon;
  if (/case|ticket|support/i.test(n))             return LifebuoyIcon;
  if (/user|contact|lead|people/i.test(n))        return UserGroupIcon;
  if (/payment|money|financ/i.test(n))            return CreditCardIcon;
  if (/document|file|folder/i.test(n))            return FolderIcon;
  if (/email|mail/i.test(n))                      return EnvelopeIcon;
  return TableCellsIcon;
}

const CONNECTOR_COLOR: Record<string, string> = {
  zoho: 'bg-blue-500', hubspot: 'bg-orange-500', salesforce: 'bg-sky-500',
  rest: 'bg-purple-500', mysql: 'bg-teal-500', postgresql: 'bg-indigo-500', mongodb: 'bg-green-500',
};

/* ── Types ─────────────────────────────────────────────────────────── */
interface CRMRecord {
  _id: string;
  displayName: string;
  externalId: string;
  channel: string;
  module: string;
  data: Record<string, unknown>;
  syncedAt: string;
}

type FieldType = 'name' | 'email' | 'phone' | 'date' | 'datetime' | 'number'
               | 'currency' | 'boolean' | 'url' | 'id' | 'text' | 'lookup';

interface ColumnSchema {
  key: string;
  label: string;
  type: FieldType;
  score: number;
  visible: boolean;
}

/* ── Schema analyzer ────────────────────────────────────────────────── */
function detectType(key: string, samples: unknown[]): FieldType {
  const k = key.toLowerCase();
  if (/email/i.test(k))                                 return 'email';
  if (/phone|mobile|cell/i.test(k))                    return 'phone';
  if (/^url$|website|linkedin|twitter|site/i.test(k))  return 'url';
  if (/amount|price|revenue|cost|value|salary|total|budget/i.test(k)) return 'currency';
  if (/\bid\b|_id$|^id$/i.test(k))                     return 'id';
  if (/name|title|subject|label|heading/i.test(k))     return 'name';

  const nonempty = samples.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonempty.length === 0) return 'text';
  const s = nonempty[0];
  if (typeof s === 'boolean') return 'boolean';
  if (typeof s === 'number')  return 'number';
  // Lookup / relation field — CRM stores as object { id, name }
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) return 'lookup';
  if (typeof s === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(s))     return 'datetime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))     return 'date';
    if (/^[\w.%+-]+@[\w.-]+\.\w+$/.test(s)) return 'email';
    if (/^https?:\/\//.test(s))             return 'url';
    if (/^\d{15,}$/.test(s))               return 'id';
  }
  return 'text';
}

function scoreColumn(key: string, type: FieldType, samples: unknown[]): number {
  const TYPE_SCORE: Record<FieldType, number> = {
    name: 100, email: 90, phone: 85, currency: 80, url: 78,
    date: 70, datetime: 65, boolean: 45, number: 55, text: 35, id: -80, lookup: 60,
  };
  let score = TYPE_SCORE[type] ?? 0;
  const filled = samples.filter((v) => v !== null && v !== undefined && v !== '').length;
  score += (samples.length > 0 ? filled / samples.length : 0) * 25;
  if (/^(name|title|subject)$/i.test(key)) score += 60;
  if (/website|phone|email|mobile/i.test(key)) score += 20;
  if (/owner/i.test(key)) score += 15;
  if (/modified|updated/i.test(key)) score -= 25;
  if (/created_time|created_at/i.test(key)) score -= 20;
  if (/\$|^_/.test(key)) score -= 100;
  return score;
}

const DEFAULT_VISIBLE_COUNT = 8;

function buildSchema(records: CRMRecord[], displayNameSample: string): ColumnSchema[] {
  if (records.length === 0) return [];
  const allKeys = new Set<string>();
  records.slice(0, 30).forEach((r) =>
    Object.keys(r.data || {}).forEach((k) => allKeys.add(k))
  );
  const scored = Array.from(allKeys)
    .filter((k) => !k.startsWith('$'))
    .map((key) => {
      const samples      = records.slice(0, 30).map((r) => r.data[key]);
      const type         = detectType(key, samples);
      const score        = scoreColumn(key, type, samples);
      const firstVal     = samples.find((v) => v !== null && v !== undefined && v !== '');
      const duplicatesName = !!(displayNameSample && firstVal === displayNameSample);
      return { key, type, score, duplicatesName };
    })
    .sort((a, b) => b.score - a.score);

  let visibleSlots = DEFAULT_VISIBLE_COUNT;
  return scored.map((col) => {
    const eligible = col.type !== 'id' && col.score > 0 && !col.duplicatesName;
    const visible  = eligible && visibleSlots > 0;
    if (visible) visibleSlots--;
    return { key: col.key, label: col.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), type: col.type, score: col.score, visible };
  });
}

/* ── Value formatters ───────────────────────────────────────────────── */
function renderCell(val: unknown, type: FieldType) {
  if (val === null || val === undefined || val === '') return <span className="text-gray-300">—</span>;
  const str = String(val);
  switch (type) {
    case 'email':
      return <a href={`mailto:${str}`} className="text-blue-600 hover:underline">{str}</a>;
    case 'url':
      return (
        <a href={str} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs">
          {str.replace(/^https?:\/\//, '')}
        </a>
      );
    case 'datetime': {
      const d = new Date(str);
      return <span className="text-gray-600">{isNaN(d.getTime()) ? str : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
    }
    case 'date': {
      const d = new Date(str + 'T00:00:00');
      return <span className="text-gray-600">{isNaN(d.getTime()) ? str : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
    }
    case 'currency': {
      const num = Number(str);
      if (isNaN(num)) return <span className="text-gray-700">{str}</span>;
      return <span className="font-medium text-gray-900">₹{num.toLocaleString('en-IN')}</span>;
    }
    case 'number':
      return <span>{Number(str).toLocaleString()}</span>;
    case 'boolean':
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    case 'lookup': {
      const obj = val as Record<string, unknown>;
      const name = String(obj?.name || obj?.Name || obj?.fullName || obj?.subject || '');
      return <span className="truncate block max-w-xs text-gray-700" title={name}>{name || '—'}</span>;
    }
    default:
      return <span className="truncate block max-w-xs" title={str}>{str}</span>;
  }
}

/* ── Field input for edit/create mode ──────────────────────────────── */
const INPUT_CLS = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white';

function FieldInput({ fieldKey, type, value, onChange }: {
  fieldKey: string;
  type: FieldType;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = value === null || value === undefined ? '' : String(value);

  if (type === 'id') {
    return <input type="text" value={str} disabled className={`${INPUT_CLS} opacity-50 cursor-not-allowed`} />;
  }
  // Lookup/relation field — CRM stores as { id, name }. Editing requires CRM-side dropdown.
  if (type === 'lookup') {
    const obj = (typeof value === 'object' && value !== null) ? value as Record<string, unknown> : {};
    const displayName = String(obj.name || obj.Name || obj.fullName || obj.subject || value || '');
    return (
      <div className={`${INPUT_CLS} flex items-center justify-between opacity-70 cursor-not-allowed`}>
        <span className="text-gray-600 truncate">{displayName || '—'}</span>
        <span className="text-xs text-gray-400 shrink-0 ml-2">Linked record · edit in CRM</span>
      </div>
    );
  }
  if (type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-600">{Boolean(value) ? 'Yes' : 'No'}</span>
      </label>
    );
  }
  if (type === 'number' || type === 'currency') {
    return <input type="number" value={str} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />;
  }
  if (type === 'date') {
    return <input type="date" value={str} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />;
  }
  if (type === 'datetime') {
    return <input type="datetime-local" value={str.slice(0, 16)} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />;
  }
  if (type === 'email') {
    return <input type="email" value={str} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} placeholder={`Enter ${fieldKey}`} />;
  }
  if (type === 'url') {
    return <input type="url" value={str} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} placeholder="https://" />;
  }
  // Any remaining object/array (arrays, nested structures) — show readonly
  if (typeof value === 'object' && value !== null) {
    return <textarea readOnly value={JSON.stringify(value, null, 2)} rows={2} className={`${INPUT_CLS} font-mono text-xs opacity-50 cursor-not-allowed`} />;
  }
  return <input type="text" value={str} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} placeholder={`Enter ${fieldKey}`} />;
}

/* ── Record drawer (view + edit + new) ─────────────────────────────── */
function RecordDrawer({
  record, schema, channel, module, isNew, onClose, onSaved, onDeleted,
}: {
  record: CRMRecord | null;
  schema: ColumnSchema[];
  channel: string;
  module: string;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const canEdit   = usePermission(`connector.${channel}.${module.toLowerCase()}.edit`);
  const canDelete = usePermission(`connector.${channel}.${module.toLowerCase()}.delete`);
  const canCreate = usePermission(`connector.${channel}.${module.toLowerCase()}.create`);

  const [editing, setEditing]           = useState(isNew && canCreate);
  const [form, setForm]                 = useState<Record<string, unknown>>(record?.data ?? {});
  const [displayName, setDisplayName]   = useState(record?.displayName ?? '');
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [error, setError]               = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // CRM connectors store relationships as nested objects — hide in create form.
  // DB connectors (mysql/postgresql/mongodb) have flat rows — show everything.
  const isCRMChannel = ['zoho', 'salesforce', 'hubspot'].includes(channel);

  // Count hidden lookup/id fields so we can show a note in create mode
  const hiddenLookupCount = useMemo(() => {
    if (!isNew || !isCRMChannel) return 0;
    return schema.filter((c) => c.type === 'id' || c.type === 'lookup').length;
  }, [schema, isNew, isCRMChannel]);

  // All keys to show in edit mode: union of schema + existing record fields.
  const allEditKeys = useMemo(() => {
    const keys = new Set([
      ...schema.map((c) => c.key),
      ...Object.keys(record?.data ?? {}),
    ]);
    return Array.from(keys).filter((k) => {
      if (k.startsWith('$')) return false;
      // For CRM channels in create mode: hide lookup and id fields (need CRM-side selection)
      if (isNew && isCRMChannel) {
        const type = schema.find((c) => c.key === k)?.type ?? 'text';
        if (type === 'id' || type === 'lookup') return false;
      }
      return true;
    });
  }, [schema, record?.data, isNew, isCRMChannel]);

  const getFieldType = (key: string): FieldType => {
    const col = schema.find((c) => c.key === key);
    if (col) return col.type;
    return detectType(key, [form[key]]);
  };

  const getLabel = (key: string): string => {
    const col = schema.find((c) => c.key === key);
    if (col) return col.label;
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.post(`/api/v1/crm/${channel}/${module}`, { data: form, displayName });
      } else {
        const changedData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(form)) {
          const orig = record!.data[k];
          // Use JSON comparison for objects, string comparison for primitives
          const same = (typeof v === 'object' || typeof orig === 'object')
            ? JSON.stringify(v ?? null) === JSON.stringify(orig ?? null)
            : String(v ?? '') === String(orig ?? '');
          if (!same) changedData[k] = v;
        }
        await api.put(`/api/v1/crm/${channel}/${module}/${record!._id}`, {
          changedData,
          displayName: displayName !== record!.displayName ? displayName : undefined,
        });
      }
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                || (e as { message?: string })?.message || 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/v1/crm/${channel}/${module}/${record!._id}`);
      onDeleted();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                || (e as { message?: string })?.message || 'Delete failed';
      setError(msg);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[500px] bg-white shadow-xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 gap-3">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div>
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-medium">Display Name</p>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Record name..."
                  className="w-full font-semibold text-gray-900 text-base border-b border-gray-300 focus:outline-none focus:border-brand-500 pb-0.5 bg-transparent"
                />
              </div>
            ) : (
              <div>
                <h2 className="font-semibold text-gray-900 text-base truncate">{record?.displayName}</h2>
                <p className="text-xs text-gray-400 mt-0.5">ID: {record?.externalId}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {!isNew && !editing && (
              <>
                {canEdit && (
                  <button
                    onClick={() => { setEditing(true); setForm({ ...record!.data }); setDisplayName(record!.displayName); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                  >
                    <TrashIcon className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </>
            )}
            {editing && (
              <>
                {(isNew ? canCreate : canEdit) && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
                {!isNew && (
                  <button
                    onClick={() => { setEditing(false); setForm({ ...record!.data }); setDisplayName(record!.displayName); setError(''); }}
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="mx-5 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800 mb-2">
              Delete "{record?.displayName}"? This will also remove it from {channel.toUpperCase()}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {editing ? (
            allEditKeys.map((key) => {
              const type  = getFieldType(key);
              const label = getLabel(key);
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    {label}
                    {type === 'id' && <span className="ml-1 text-gray-300 normal-case">(read-only)</span>}
                  </label>
                  <FieldInput
                    fieldKey={key}
                    type={type}
                    value={form[key]}
                    onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  />
                </div>
              );
            })
          ) : (
            (() => {
              const viewKeys = Array.from(new Set([
                ...schema.map((c) => c.key),
                ...Object.keys(record?.data ?? {}),
              ])).filter((k) => !k.startsWith('$'));
              return viewKeys.map((key) => {
                const val = record?.data[key];
                if (val === null || val === undefined || val === '') return null;
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">{getLabel(key)}</p>
                    <div className="text-sm text-gray-900">{renderCell(val, getFieldType(key))}</div>
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Footer hint when editing */}
        {editing && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 space-y-1">
            <p className="text-xs text-gray-400">
              Changes save locally and sync back to <span className="font-medium uppercase">{channel}</span> automatically.
            </p>
            {isNew && hiddenLookupCount > 0 && (
              <p className="text-xs text-amber-600">
                {hiddenLookupCount} linked-record field{hiddenLookupCount > 1 ? 's' : ''} (like Account, Owner) hidden —
                set {hiddenLookupCount > 1 ? 'them' : 'it'} from {channel.toUpperCase()} after saving.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Column picker panel ────────────────────────────────────────────── */
function ColumnPicker({ schema, onChange, onClose }: {
  schema: ColumnSchema[];
  onChange: (schema: ColumnSchema[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-10 z-30 w-64 bg-white rounded-xl shadow-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">Columns</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {schema.filter((c) => !c.key.startsWith('$') && c.score > -50).map((col) => (
          <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={col.visible}
              onChange={() => onChange(schema.map((c) => c.key === col.key ? { ...c, visible: !c.visible } : c))}
              className="rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm text-gray-700 truncate">{col.label}</span>
            <span className="ml-auto text-xs text-gray-400">{col.type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

/* ── Main page ──────────────────────────────────────────────────────── */
export default function CRMDataPage() {
  const { channel = '', module: mod = '' } = useParams<{ channel: string; module: string }>();

  const canCreate = usePermission(`connector.${channel}.${mod.toLowerCase()}.create`);

  const [records, setRecords]               = useState<CRMRecord[]>([]);
  const [schema, setSchema]                 = useState<ColumnSchema[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [search, setSearch]                 = useState('');
  const [loading, setLoading]               = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<CRMRecord | null>(null);
  const [showNewDrawer, setShowNewDrawer]   = useState(false);
  const [showPicker, setShowPicker]         = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const res = await api.get(`/api/v1/crm/${channel}/${mod}?${params}`);
      const data: CRMRecord[] = res.data.data || [];
      setRecords(data);
      setTotal(res.data.total || 0);
      const firstDisplayName = data[0]?.displayName ?? '';
      setSchema(buildSchema(data, firstDisplayName));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [channel, mod, page, search]);

  useEffect(() => { setPage(1); setSearch(''); setSchema([]); }, [channel, mod]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const visibleCols = schema.filter((c) => c.visible);
  const totalPages  = Math.ceil(total / PAGE_SIZE);

  const getDisplayName = (record: CRMRecord): string => {
    if (record.displayName && !/^\d{10,}$/.test(record.displayName)) return record.displayName;
    const nameField = schema.find((c) => c.type === 'name' && c.score > 50);
    if (nameField) return String(record.data[nameField.key] || record.displayName);
    return record.displayName || record.externalId;
  };

  const handleSaved  = () => { setSelectedRecord(null); setShowNewDrawer(false); fetchRecords(); };
  const handleDeleted = () => { setSelectedRecord(null); fetchRecords(); };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          {(() => { const ModIcon = getModuleIcon(mod); return <ModIcon className="h-7 w-7 text-gray-700 shrink-0" />; })()}
          <h1 className="text-2xl font-bold text-gray-900">{mod}</h1>
          <span className="ml-1 px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
            {total} records
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`h-2 w-2 rounded-full ${CONNECTOR_COLOR[channel] || 'bg-gray-400'}`} />
          <p className="text-sm text-gray-400 capitalize">{channel} · Synced Automatically</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${mod}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {canCreate && (
          <button
            onClick={() => setShowNewDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            <PlusIcon className="h-4 w-4" />
            Add Record
          </button>
        )}

        <div className="relative ml-auto">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Columns
          </button>
          {showPicker && (
            <ColumnPicker schema={schema} onChange={setSchema} onClose={() => setShowPicker(false)} />
          )}
        </div>

        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-auto">
        {!loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">No records found</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-2 text-xs text-brand-600 hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap min-w-[160px]">Name</th>
                {visibleCols.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr
                  key={record._id}
                  onClick={() => setSelectedRecord(record)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {getDisplayName(record)}
                  </td>
                  {visibleCols.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-600">
                      {renderCell(record.data[col.key], col.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}

      {/* View / Edit drawer */}
      {selectedRecord && (
        <RecordDrawer
          record={selectedRecord}
          schema={schema}
          channel={channel}
          module={mod}
          isNew={false}
          onClose={() => setSelectedRecord(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* New record drawer */}
      {showNewDrawer && (
        <RecordDrawer
          record={null}
          schema={schema}
          channel={channel}
          module={mod}
          isNew={true}
          onClose={() => setShowNewDrawer(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
