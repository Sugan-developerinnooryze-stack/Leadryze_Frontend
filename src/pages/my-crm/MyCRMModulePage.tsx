import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MagnifyingGlassIcon, ArrowLeftIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

interface CRMRecord {
  _id: string;
  externalId: string;
  displayName: string;
  data: Record<string, unknown>;
  syncedAt: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  zoho:       '#ef4444',
  hubspot:    '#f97316',
  salesforce: '#3b82f6',
  mysql:      '#10b981',
  postgresql: '#8b5cf6',
  mongodb:    '#22c55e',
};

const TOP_FIELDS = ['email', 'phone', 'Email', 'Phone', 'mobile', 'Mobile'];

function pickPreviewFields(data: Record<string, unknown>): [string, unknown][] {
  const result: [string, unknown][] = [];
  // Priority: email/phone first
  for (const key of TOP_FIELDS) {
    if (data[key] && String(data[key]).trim()) result.push([key, data[key]]);
    if (result.length >= 2) break;
  }
  // Then fill remaining up to 4 total from all keys
  for (const [k, v] of Object.entries(data)) {
    if (result.length >= 4) break;
    if (!v || !String(v).trim()) continue;
    if (result.find(([rk]) => rk === k)) continue;
    if (TOP_FIELDS.includes(k)) continue;
    result.push([k, v]);
  }
  return result;
}

export default function MyCRMModulePage() {
  const { channel = '', module: mod = '' } = useParams<{ channel: string; module: string }>();
  const [records, setRecords] = useState<CRMRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchRecords = useCallback(async (pg: number, q: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/crm/${channel}/${mod}`, {
        params: { page: pg, limit: LIMIT, search: q || undefined },
      });
      setRecords(res.data.data?.records || res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [channel, mod]);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setExpandedId(null);
    fetchRecords(1, '');
  }, [channel, mod, fetchRecords]);

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
    fetchRecords(1, q);
  }

  const accentColor = CHANNEL_COLORS[channel] || '#6366f1';
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/my-crm" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          <h1 className="text-xl font-bold text-gray-900 truncate">{mod}</h1>
          <span className="text-xs text-gray-400 capitalize shrink-0">{channel}</span>
          {total > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{total} records</span>}
        </div>

      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text" value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder={`Search ${mod}...`}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Records list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CalendarDaysIcon className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{search ? 'No records match your search' : 'No records synced yet'}</p>
          </div>
        )}

        {!loading && records.map(rec => {
          const preview = pickPreviewFields(rec.data);
          const isExpanded = expandedId === rec._id;
          const allFields = Object.entries(rec.data).filter(([, v]) => v !== null && String(v).trim());

          return (
            <div key={rec._id}
              className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{rec.displayName || '—'}</p>
                  <div className="flex gap-4 mt-0.5">
                    {preview.map(([k, v]) => (
                      <span key={k} className="text-xs text-gray-500 truncate max-w-[160px]">{String(v)}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? 'Less' : 'More'}
                  </button>
                </div>
              </div>

              {/* Expanded fields */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {allFields.map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-gray-400 shrink-0 w-28 truncate capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-gray-700 flex-1 min-w-0 truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page === 1}
            onClick={() => { const p = page - 1; setPage(p); fetchRecords(p, search); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => { const p = page + 1; setPage(p); fetchRecords(p, search); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}
