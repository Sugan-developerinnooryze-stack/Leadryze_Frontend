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

export default function Layout() {
  const { token }      = useAuthStore();
  const { loadFlags }  = useFeatureFlagsStore();
  useInactivityLogout();
  const { pathname }   = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isFullPage = FULL_PAGE_ROUTES.some(r => pathname.startsWith(r));

  useEffect(() => {
    if (!token) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFlags(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token]);

  return (
    <div className="flex print:block h-screen print:h-auto bg-gray-50 overflow-hidden print:overflow-visible">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible min-w-0">
        <Header />
        <main className={`flex-1 min-h-0 ${isFullPage ? 'overflow-hidden' : 'overflow-y-auto p-6'} print:overflow-visible print:p-0`}>
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
