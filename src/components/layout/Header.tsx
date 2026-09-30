import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bars3Icon, BellIcon, ArrowLeftStartOnRectangleIcon, SunIcon, MoonIcon, Cog6ToothIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
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

export default function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user, handleLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const { activeChannels, toggleChannel } = useSourceFilterStore();
  const { flags } = useFeatureFlagsStore();
  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onClickAway = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [userMenuOpen]);

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
    <header className="h-16 bg-surface border-b border-border shadow-sm shrink-0 print:hidden">
      {/* Content caps at 1600px and centers — below that (everything up
         through the 1440px target breakpoint) this is a no-op full-width
         row, unchanged. Above it (a ~1630px+ viewport once the 240px
         sidebar is subtracted — e.g. a 1920px monitor), it stops the row
         from stretching into a lopsided empty gap on the right and gives
         balanced side gutters instead, matching the page content's own
         p-6 rhythm below it. */}
      <div className="h-full max-w-[1600px] mx-auto grid items-center px-5 gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}>

      {/* ── LEFT: mobile nav trigger + connector source filter, grouped into
         one flex row sharing a single flexible track with the right-side
         icon cluster. Both outer tracks are equal (1fr), so the search
         column between them sits at true dead-center of the header no
         matter how many connector chips are active — previously the search
         box only centered within its own leftover column, which grew or
         shrank as connectors were added/removed (e.g. adding a HubSpot
         connector alongside Salesforce/Zoho would visibly shift it).
         overflow-x-auto is a defensive fallback if chips ever outgrow the
         column on a narrow viewport, rather than colliding with the search
         box. ── */}
      <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
        {/* Mobile nav trigger — hidden ≥lg, where the desktop sidebar takes over */}
        <button
          onClick={onOpenMobileNav}
          title="Open menu"
          className="lg:hidden shrink-0 p-2 -ml-1 rounded-xl text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        {/* Connector source filter — hidden below sm, a secondary
           power-user filter that otherwise crowds out the search bar on a
           phone-width screen (confirmed visually: without this, BranchSwitcher
           and these chips together left no room for search at 375px). */}
        <div className="hidden sm:flex items-center gap-1.5 min-w-0 shrink-0">
          {visibleConnectors.length > 0 && (
            <>
              <span className="text-[11px] text-text-muted font-semibold uppercase tracking-wider mr-1 shrink-0 hidden sm:inline">
                View
              </span>

              {/* All chip */}
              <button
                onClick={() => useSourceFilterStore.getState().setActiveChannels([])}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                  allOn
                    ? 'bg-ryze-600 text-white shadow-sm'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted hover:bg-black/[0.07] dark:hover:bg-white/[0.1]'
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
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 border ${
                      isActive
                        ? 'bg-ryze-600 text-white border-ryze-600 shadow-sm'
                        : allOn
                          ? 'bg-surface text-text-muted border-border hover:border-ryze-300 hover:text-ryze-600'
                          : 'bg-transparent text-text-muted/50 border-border/50'
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
      </div>

      {/* ── CENTER: universal search ── */}
      <div className="flex justify-center min-w-0">
        <UniversalSearch />
      </div>

      {/* ── RIGHT: theme toggle, notifications, user menu ──
         This track is a real 1fr, matching the left one, so the search
         column between them stays centered — justify-self-end pins this
         row's content to the header's right edge instead of letting it sit
         left-aligned within that column's leftover space. ── */}
      <div className="flex items-center gap-2 justify-self-end min-w-0">

        {/* Branch switcher — hidden below sm, same reasoning as the
           connector filter chips on the left. */}
        <div className="hidden sm:block">
          <BranchSwitcher />
        </div>

        {/* Divider — also drops out in the lg–xl "dead zone" (1024–1279px),
           where the sidebar has just gone permanent (w-60, see Sidebar.tsx)
           but the viewport isn't wide enough yet to absorb it plus the
           full identity block; see the name/role block below. */}
        <div className="h-7 w-px bg-border mx-1 hidden sm:block lg:hidden xl:block" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150"
        >
          {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>

        {/* Bell */}
        <button className="relative p-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150">
          <BellIcon className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="h-7 w-px bg-border mx-1 hidden sm:block lg:hidden xl:block" />

        {/* User menu — consolidates Settings + Logout (both pre-existing
           actions elsewhere) behind one affordance, rather than a static
           info block plus a permanently-visible Logout button. The name/
           role/chevron drop to avatar-only across the lg–xl dead zone
           (1024–1279px) — confirmed via screenshot that at 1024 the full
           block pushed "Tenant Admin"/"ADMIN" off the right edge once the
           sidebar goes permanent; BranchSwitcher stays put since it's a
           real control, not identity chrome. */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <div className="h-8 w-8 rounded-xl bg-ryze-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden sm:block lg:hidden xl:block leading-tight text-left">
              <p className="text-sm font-semibold text-text-primary whitespace-nowrap">
                {user?.firstName} {user?.lastName}
              </p>
              {roleLabel && (
                <p className="text-[10px] font-semibold text-ryze-600 dark:text-ryze-400 uppercase tracking-wide">
                  {roleLabel}
                </p>
              )}
            </div>
            <ChevronDownIcon className={`h-3.5 w-3.5 text-text-muted shrink-0 transition-transform hidden sm:block lg:hidden xl:block ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-elevated border border-border rounded-xl shadow-lg py-1.5 z-50">
              <button
                onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <Cog6ToothIcon className="h-4 w-4 text-text-muted shrink-0" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-danger-600 hover:bg-danger-500/10 transition-colors"
              >
                <ArrowLeftStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
