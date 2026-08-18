import { useState, useEffect } from 'react';
import { ShieldCheckIcon, LockClosedIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useTenantQuery, useUpdateTenantDataScopeConfig,
} from '../../../modules/native-crm/queries/tenant.queries';

/** Mirrors backend/src/modules/native-crm/shared/data-scope.ts's own
 * DEFAULT_DATA_SCOPE_CONFIG exactly — kept as a separate copy since the
 * frontend has no shared build step with the backend, same convention
 * already used for the widget's own CARTESIA_VOICE_PRESETS/language list. */
const TRANSACTIONAL_MODULES: Array<{ key: string; label: string }> = [
  { key: 'leads',      label: 'Leads' },
  { key: 'meetings',   label: 'Meetings' },
  { key: 'customers',  label: 'Customers' },
  { key: 'teams',      label: 'Teams' },
  { key: 'staffs',     label: 'Staffs' },
  { key: 'deals',      label: 'Deals' },
  { key: 'tasks',      label: 'Tasks' },
  { key: 'contacts',   label: 'Contacts' },
  { key: 'companies',  label: 'Companies' },
  { key: 'tickets',    label: 'Tickets' },
  { key: 'calls',      label: 'Calls' },
  { key: 'sites',      label: 'Sites' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'workorders', label: 'Work Orders' },
  { key: 'contracts',  label: 'Contracts' },
  { key: 'invoices',   label: 'Invoices' },
  { key: 'receipts',   label: 'Receipts' },
  { key: 'expenses',   label: 'Expenses' },
  { key: 'activities', label: 'Activities' },
  { key: 'assets',     label: 'Assets' },
  { key: 'vehicles',   label: 'Vehicles' },
];

const CATALOG_MODULES: Array<{ key: string; label: string }> = [
  { key: 'categories', label: 'Categories' },
  { key: 'services',   label: 'Services' },
  { key: 'products',   label: 'Products' },
  { key: 'parts',      label: 'Parts' },
  { key: 'catalog',    label: 'Product Catalog (AI Widget)' },
];

const ALL_MODULES = [...TRANSACTIONAL_MODULES, ...CATALOG_MODULES];

function defaultFor(key: string): boolean {
  return TRANSACTIONAL_MODULES.some((m) => m.key === key);
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
      />
      <span className={`text-xs font-medium ${checked ? 'text-brand-700' : 'text-gray-500'}`}>
        {checked ? 'Scoped to each Supervisor' : 'Full access for everyone'}
      </span>
    </label>
  );
}

export default function DataScopeSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');
  const tenantId = user?.tenantId ?? '';

  const { data: tenant, isLoading, error } = useTenantQuery(isAdmin ? tenantId : '');
  const updateMutation = useUpdateTenantDataScopeConfig(tenantId);

  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const merged: Record<string, boolean> = {};
    for (const m of ALL_MODULES) {
      merged[m.key] = tenant.dataScopeConfig?.[m.key] ?? defaultFor(m.key);
    }
    setConfig(merged);
    setDirty(false);
  }, [tenant]);

  const setModule = (key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMessage(null);
  };

  const handleSave = async () => {
    setMessage(null);
    try {
      await updateMutation.mutateAsync(config);
      setDirty(false);
      setMessage({ type: 'ok', text: 'Saved — Managers and Agents will see the updated visibility on their next request.' });
    } catch {
      setMessage({ type: 'err', text: 'Could not save — please try again.' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-400">
        <LockClosedIcon className="h-10 w-10 mb-2 text-gray-300" />
        <p className="text-sm">Only admins can configure data visibility.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-2">{[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        Could not load tenant settings.
      </div>
    );
  }

  const renderSection = (title: string, subtitle: string, modules: Array<{ key: string; label: string }>) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {modules.map((m) => (
          <div key={m.key} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{m.label}</span>
            <Toggle checked={config[m.key] ?? defaultFor(m.key)} onChange={(v) => setModule(m.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <ShieldCheckIcon className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Data Visibility</h1>
          <p className="text-xs text-gray-500">
            Decide, per module, whether a Supervisor (Manager) or Staff (Agent) login only sees their own team's
            records, or everyone's — Tenant Admin always sees everything either way.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {renderSection(
            'Transactional Modules',
            'Real business records — defaults to Scoped, so each Supervisor sees only their own team’s work.',
            TRANSACTIONAL_MODULES,
          )}
          {renderSection(
            'Catalog & Reference Modules',
            'Shared setup data (a Service, a Product) usually isn’t personally owned by one Supervisor — defaults to Full Access.',
            CATALOG_MODULES,
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!dirty || updateMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            {message && (
              <p className={`text-xs ${message.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
