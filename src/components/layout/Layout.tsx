import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatWidget from '../ChatWidget';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import { useAuthStore } from '../../stores/auth.store';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';

// Routes that need zero padding and overflow-hidden (full-page layouts)
const FULL_PAGE_ROUTES = ['/my-crm'];

const COLLAPSED_KEY = 'leadryze-sidebar-collapsed';
function loadCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
}

export default function Layout() {
  const { token }      = useAuthStore();
  const { loadFlags }  = useFeatureFlagsStore();
  useInactivityLogout();
  const { pathname }   = useLocation();
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  // Mobile slide-over — separate from desktop collapsed/expanded. Owned
  // here since Header's hamburger trigger and Sidebar's drawer both need
  // to share it.
  const [mobileOpen, setMobileOpen] = useState(false);

  const isFullPage = FULL_PAGE_ROUTES.some(r => pathname.startsWith(r));

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Close the mobile drawer on every route change — the drawer is meant
  // to get out of the way once a destination is picked, matching the
  // plan's "closes on backdrop click / route change / Escape" requirement.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!token) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFlags(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token]);

  return (
    <div className="flex print:block h-screen print:h-auto bg-background overflow-hidden print:overflow-visible">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible min-w-0">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main className={`flex-1 min-h-0 ${isFullPage ? 'overflow-hidden' : 'overflow-y-auto p-6'} print:overflow-visible print:p-0`}>
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
