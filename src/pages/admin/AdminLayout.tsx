import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bars3Icon, ArrowLeftOnRectangleIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import { useAuthStore } from '../../stores/auth.store';
import { useTheme } from '../../hooks/useTheme';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden text-text-muted hover:text-text-primary -ml-1 p-1.5"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <span className="text-sm text-text-muted hidden sm:block">{user?.email}</span>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <button
              onClick={() => { logout(); navigate('/admin/login'); }}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
