import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellIcon, ArrowLeftStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import UniversalSearch from './UniversalSearch';
import { BranchSwitcher } from '../native-crm/BranchSwitcher';

interface ConnectorInfo {
  _id: string;
  type: string;
  name: string;
  isActive: boolean;
  lastSyncAt?: string;
}

const CHANNEL_DOT: Record<string, string> = {
  zoho:       'bg-blue-500',
  hubspot:    'bg-orange-500',
  salesforce: 'bg-sky-500',
  rest:       'bg-purple-500',
  mysql:      'bg-teal-500',
  postgresql: 'bg-indigo-500',
  mongodb:    'bg-green-500',
};

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: 'Admin',
  ADMIN:        'Admin',
  AGENT:        'Agent',
  VIEWER:       'Viewer',
};

export default function Header() {
  const { user, handleLogout } = useAuth();
  const location = useLocation();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const { activeChannels, toggleChannel } = useSourceFilterStore();
  const { flags } = useFeatureFlagsStore();

  useEffect(() => {
    if (!user?.tenantId) return;
    api.get('/api/v1/connectors')
      .then((r) => {
        const active = (r.data.data as ConnectorInfo[]).filter((c) => c.isActive && c.lastSyncAt);
        setConnectors(active);
      })
      .catch(() => {});
  }, [user?.tenantId, location.pathname]);

  const visibleConnectors = connectors.filter(
    (c) => flags[`connector_${c.type}` as keyof typeof flags] !== false
  );

  const connectedTypes = visibleConnectors.map((c) => c.type);
  const allOn = activeChannels.length === 0 || connectedTypes.every((t) => activeChannels.includes(t));
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const roleLabel = ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '';

  return (
    <header className="h-16 bg-white border-b border-gray-100 shadow-sm shrink-0 grid items-center px-5 gap-4 print:hidden"
      style={{ gridTemplateColumns: 'auto 1fr auto' }}>

      {/* ── LEFT: connector source filter ── */}
      <div className="flex items-center gap-1.5 min-w-0">
        {visibleConnectors.length > 0 && (
          <>
            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mr-1 shrink-0">
              View
            </span>

            {/* All chip */}
            <button
              onClick={() => useSourceFilterStore.getState().setActiveChannels([])}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                allOn
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              All
            </button>

            {/* One chip per connector */}
            {visibleConnectors.map((connector) => {
              const isActive = activeChannels.length === 1 && activeChannels[0] === connector.type;
              const dot = CHANNEL_DOT[connector.type] ?? 'bg-gray-400';
              return (
                <button
                  key={connector._id}
                  onClick={() => toggleChannel(connector.type)}
                  title={`Show only ${connector.name} data`}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : allOn
                        ? 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                        : 'bg-gray-50 text-gray-300 border-gray-100'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : dot}`} />
                  <span className="capitalize">{connector.type}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* ── CENTER: universal search (perfectly centered by grid 1fr) ── */}
      <div className="flex justify-center">
        <UniversalSearch />
      </div>

      {/* ── RIGHT: notifications + user card + logout ── */}
      <div className="flex items-center gap-2">

        {/* Branch switcher */}
        <BranchSwitcher />

        {/* Divider */}
        <div className="h-7 w-px bg-gray-200 mx-1" />

        {/* Bell */}
        <button className="relative p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-150">
          <BellIcon className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="h-7 w-px bg-gray-200 mx-1" />

        {/* User card */}
        <div className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-gray-50 transition-colors cursor-default">
          {/* Avatar */}
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          {/* Name + role */}
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">
              {user?.firstName} {user?.lastName}
            </p>
            {roleLabel && (
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                {roleLabel}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-px bg-gray-200 mx-1" />

        {/* Logout button — clearly visible */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-all duration-150"
          title="Log out"
        >
          <ArrowLeftStartOnRectangleIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
