import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';

interface SearchRecord {
  id: string;
  channel: string;
  module: string;
  displayName: string;
  isSecondary: boolean;
  data: Record<string, string>;
}

interface SearchResponse {
  results: SearchRecord[];
  query: string;
  total: number;
}

const CHANNEL_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  zoho:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  hubspot:    { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  salesforce: { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  mysql:      { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  postgresql: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  mongodb:    { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  rest:       { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  native:     { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  web:        { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
};

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-green-600',
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

const EMAIL_RE = /^[\w.+%-]+@[\w.-]+\.\w{2,}$/;
const PHONE_RE = /^[+\d][\d\s\-().]{6,}$/;

function getKeyValue(data: Record<string, string>): string | null {
  for (const v of Object.values(data)) if (EMAIL_RE.test(v.trim())) return v;
  for (const v of Object.values(data)) if (PHONE_RE.test(v.trim()) && /\d{6,}/.test(v)) return v;
  return Object.values(data).find((v) => v && v.length > 2 && v.length < 60) ?? null;
}

export default function UniversalSearch() {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);
  const [focused, setFocused]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate     = useNavigate();

  // Ctrl+K / Cmd+K shortcut to open search
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: SearchResponse }>('/api/v1/crm/search', { params: { q, limit: 8 } });
      const hits = res.data.data?.results ?? [];
      setResults(hits);
      setActiveIdx(-1);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 280);
  };

  const handleSelect = (r: SearchRecord) => {
    setOpen(false); setQuery(''); setResults([]);
    if (r.channel === 'native') {
      navigate(`/crm/${encodeURIComponent(r.module)}`);
      return;
    }
    useSourceFilterStore.getState().setActiveChannels([r.channel]);
    const mod = r.module.toLowerCase();
    if (mod === 'contacts' || mod === 'leads') {
      navigate('/customers');
    } else {
      navigate(`/crm/${encodeURIComponent(r.channel)}/${encodeURIComponent(r.module)}`);
    }
  };

  const handleClear = () => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(results[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = focused || open;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">

      {/* ── Search input ── */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 transition-all duration-200 ${
        isActive
          ? 'border-blue-500 bg-white shadow-lg shadow-blue-100'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white hover:shadow-sm'
      }`}>

        {/* Search icon */}
        <div className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
          {loading
            ? <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            : <MagnifyingGlassIcon className="h-4 w-4" />
          }
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { setFocused(true); if (results.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search contacts, products, records…"
          className="flex-1 bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 outline-none min-w-0"
        />

        {/* Right side: clear button OR keyboard shortcut hint */}
        {query ? (
          <button onClick={handleClear} className="shrink-0 p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className="shrink-0 hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
              Ctrl
            </kbd>
            <span className="text-[10px] text-gray-300">+</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
              K
            </kbd>
          </div>
        )}
      </div>

      {/* ── Results dropdown ── */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/80 z-50 overflow-hidden">

          {results.length === 0 ? (
            <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No results found</p>
              <p className="text-xs text-gray-400">Try a different name, email, or phone number</p>
            </div>
          ) : (
            <>
              {/* Header bar */}
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </span>
                <span className="text-[10px] text-gray-400 hidden sm:block">
                  ↑↓ to navigate · Enter to open · Esc to close
                </span>
              </div>

              {/* Result list */}
              <div className="max-h-80 overflow-y-auto">
                {results.map((r, idx) => {
                  const keyVal   = getKeyValue(r.data);
                  const initials = r.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                  const chStyle  = CHANNEL_STYLE[r.channel] ?? { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
                  const isHighlighted = idx === activeIdx;

                  return (
                    <button
                      key={`${r.channel}-${r.module}-${r.displayName}-${idx}`}
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full px-4 py-3 flex items-center gap-3.5 text-left transition-colors duration-100 border-b border-gray-50 last:border-0 ${
                        isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Avatar with gradient */}
                      <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${avatarGradient(r.displayName)} flex items-center justify-center shrink-0 shadow-sm`}>
                        <span className="text-white text-xs font-bold">{initials || '?'}</span>
                      </div>

                      {/* Record info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`text-sm font-semibold truncate transition-colors ${isHighlighted ? 'text-blue-700' : 'text-gray-900'}`}>
                            {r.displayName}
                          </p>
                          {/* Module pill */}
                          <span className="shrink-0 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                            {r.module}
                          </span>
                        </div>
                        {keyVal && (
                          <p className="text-xs text-gray-500 truncate mt-0.5 font-mono">{keyVal}</p>
                        )}
                      </div>

                      {/* Channel badge */}
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border ${chStyle.bg} ${chStyle.text} ${chStyle.border}`}>
                        {r.channel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  Powered by <span className="font-semibold text-gray-500">Meilisearch</span> · typo-tolerant
                </span>
                <span className="text-[10px] text-blue-500 font-medium cursor-pointer hover:underline">
                  View all →
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
