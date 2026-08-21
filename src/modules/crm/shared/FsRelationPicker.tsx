import { useState } from 'react';
import { LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCustomersListQuery } from '../../native-crm/queries/customers.queries';
import { useQuotationsListQuery } from '../../native-crm/queries/quotations.queries';
import { useWorkordersListQuery } from '../../native-crm/queries/workorders.queries';
import { useContractsListQuery } from '../../native-crm/queries/contracts.queries';
import { useContactsListQuery } from '../queries/contacts.queries';
import { useCompaniesListQuery } from '../queries/companies.queries';
import { useProductsListQuery } from '../../native-crm/queries/products.queries';
import { useAssetsListQuery } from '../../native-crm/queries/assets.queries';

// 'deal' is accepted at the type level (matches activity-feed.queries.ts's
// own RelatedModule, and Ticket's backend relatedModule enum already
// included it) but has no search UI here — no useDealsListQuery hook exists
// yet, and nothing in this app currently invokes the picker with it. Kept in
// the union so ActivityFeedPanel's prefillRelation (real deal-view activity
// feeds, once one exists) type-checks correctly rather than needing a cast.
export type FsRelatedModule = 'customer' | 'quotation' | 'workorder' | 'contract' | 'contact' | 'company' | 'product' | 'asset' | 'deal';

export interface FsRelation {
  relatedModule?: FsRelatedModule;
  relatedId?:     string;
  relatedLabel?:  string;
}

const MODULE_OPTIONS: { value: FsRelatedModule; label: string }[] = [
  { value: 'customer',  label: 'Customer' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'workorder', label: 'Work Order' },
  { value: 'contract',  label: 'Contract' },
  { value: 'contact',   label: 'Contact' },
  { value: 'company',   label: 'Company' },
  { value: 'product',   label: 'Product' },
  { value: 'asset',     label: 'Asset' },
];

// Every Field Service record uses its own human-facing *Id field alongside a
// name/title — Contacts/Companies (Native CRM) have no such human ID, so
// fall back to just the display name for those two.
function humanId(m: FsRelatedModule, r: any): string | null {
  if (m === 'customer')  return r.customerId;
  if (m === 'quotation') return r.quotationId;
  if (m === 'workorder') return r.workOrderId;
  if (m === 'contract')  return r.contractId;
  if (m === 'product')   return r.productId;
  if (m === 'asset')     return r.assetId;
  return null;
}
function displayName(m: FsRelatedModule, r: any): string {
  if (m === 'customer') return r.name;
  if (m === 'contact')  return `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  if (m === 'company')  return r.name;
  if (m === 'product')  return r.name;
  if (m === 'asset')    return r.name;
  return r.title;
}

function useSearchResults(moduleType: FsRelatedModule, search: string) {
  const enabled = search.trim().length > 0;
  const params = { page: 1, limit: 10, search: enabled ? search : '__none__' };
  const customers  = useCustomersListQuery(params);
  const quotations = useQuotationsListQuery(params);
  const workorders = useWorkordersListQuery(params);
  const contracts  = useContractsListQuery(params);
  const contacts   = useContactsListQuery(params);
  const companies  = useCompaniesListQuery(params);
  const products   = useProductsListQuery(params);
  const assets     = useAssetsListQuery(params);
  if (!enabled) return { items: [], isLoading: false };
  if (moduleType === 'customer')  return { items: customers.data?.items ?? [],  isLoading: customers.isLoading };
  if (moduleType === 'quotation') return { items: quotations.data?.items ?? [], isLoading: quotations.isLoading };
  if (moduleType === 'workorder') return { items: workorders.data?.items ?? [], isLoading: workorders.isLoading };
  if (moduleType === 'contact')   return { items: contacts.data?.items ?? [],   isLoading: contacts.isLoading };
  if (moduleType === 'company')   return { items: companies.data?.items ?? [],  isLoading: companies.isLoading };
  if (moduleType === 'product')   return { items: products.data?.items ?? [],   isLoading: products.isLoading };
  if (moduleType === 'asset')     return { items: assets.data?.items ?? [],     isLoading: assets.isLoading };
  return { items: contracts.data?.items ?? [], isLoading: contracts.isLoading };
}

/**
 * Lets a Task/Ticket/Call/Meeting link to a real Field Service record
 * (Customer/Quotation/Work Order/Contract) so it shows up in that record's
 * own Activity feed. Bolted onto RecordDrawer the same way Custom Fields
 * are — its own state slice, merged into the payload on submit — rather than
 * extending the generic FieldConfig/CrmField machinery every other Native
 * CRM module uses.
 */
export default function FsRelationPicker({ value, onChange }: { value: FsRelation; onChange: (v: FsRelation) => void }) {
  const [moduleType, setModuleType] = useState<FsRelatedModule>(value.relatedModule ?? 'customer');
  const [search, setSearch] = useState('');
  const { items, isLoading } = useSearchResults(moduleType, search);

  if (value.relatedId) {
    return (
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Linked Field Service Record</p>
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <LinkIcon className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-sm text-blue-800 truncate">{value.relatedLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange({})}
            className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 shrink-0"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Link to a Field Service record</p>
      <div className="flex gap-2 mb-2">
        <select
          value={moduleType}
          onChange={(e) => { setModuleType(e.target.value as FsRelatedModule); setSearch(''); }}
          className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
        >
          {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${MODULE_OPTIONS.find((o) => o.value === moduleType)?.label.toLowerCase()}s…`}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
      {search.trim() && (
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {isLoading && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
          {!isLoading && items.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No matches</div>}
          {items.map((r: any) => {
            const rid = humanId(moduleType, r);
            const name = displayName(moduleType, r);
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => onChange({
                  relatedModule: moduleType,
                  relatedId: r._id,
                  relatedLabel: rid ? `${rid} — ${name}` : name,
                })}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {rid && <span className="font-medium text-gray-800">{rid}</span>}
                <span className={rid ? 'text-gray-400' : 'font-medium text-gray-800'}>{rid ? ` — ${name}` : name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
