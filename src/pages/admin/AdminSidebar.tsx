import { NavLink } from 'react-router-dom';
import {
  Squares2X2Icon, BuildingOffice2Icon, UsersIcon, ChatBubbleLeftRightIcon,
  HeartIcon, ClipboardDocumentCheckIcon, ShieldCheckIcon, KeyIcon, XMarkIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }> }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { to: '/admin/overview', label: 'Overview', icon: Squares2X2Icon },
      { to: '/admin/tenants',  label: 'Tenants',  icon: BuildingOffice2Icon },
      { to: '/admin/users',    label: 'Users',    icon: UsersIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/conversations', label: 'AI Conversations', icon: ChatBubbleLeftRightIcon },
      { to: '/admin/health',        label: 'Health',           icon: HeartIcon },
      { to: '/admin/logs',          label: 'Logs',              icon: ClipboardDocumentCheckIcon },
    ],
  },
  {
    label: 'Security',
    items: [
      { to: '/admin/security', label: 'Security Center', icon: ShieldCheckIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/system', label: 'System Settings', icon: KeyIcon },
      { to: '/admin/platform-defaults', label: 'Platform Defaults', icon: AdjustmentsHorizontalIcon },
    ],
  },
];

interface AdminSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  return (
    <>
      {/* Backdrop — mobile/tablet only, shown while the drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col shrink-0 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-ryze-500 to-ryze-700 flex items-center justify-center">
              <ShieldCheckIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary leading-tight">LeadRyze AI</p>
              <p className="text-[11px] text-text-muted leading-tight">Super Admin</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden text-text-muted hover:text-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400' : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
