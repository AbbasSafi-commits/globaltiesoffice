import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { ModuleKey, useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  module?: ModuleKey;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', to: '/clients', icon: Users, module: 'clients' },
  { label: 'Ledger', to: '/ledger', icon: BookOpen, module: 'ledger' },
  { label: 'Documents', to: '/documents', icon: FileText, module: 'documents' },
  { label: 'Permissions', to: '/permissions', icon: ShieldCheck, superAdminOnly: true },
];

function formatRoleLabel(role?: string): string {
  if (!role) return 'Staff';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Primary office shell featuring a deep blue sidebar navigation,
 * responsive mobile drawer, and top user/role bar.
 */
export function AppLayout() {
  const { profile, isSuperAdmin, can, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.module) return can(item.module, 'view');
    return true;
  });

  const activeNav = visibleNavItems.find((item) => location.pathname.startsWith(item.to));
  const currentTitle = activeNav?.label ?? 'Dashboard';

  const roleLabel = formatRoleLabel(profile?.role);
  const displayName = profile?.fullName || profile?.email || 'Staff Member';

  const renderSidebarContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-[#0F2942] text-white">
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <BrandLogo variant="light" size="sm" />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="lg:hidden rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-xs text-slate-300 truncate">{profile?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 print:hidden">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full shadow-xl">
            {renderSidebarContent(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">
                Global Ties Office
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-slate-900 truncate">
                {currentTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm font-medium text-slate-800 truncate max-w-[140px] sm:max-w-[220px]">
                {displayName}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 border ${
                  isSuperAdmin
                    ? 'bg-blue-50 text-[#0F2942] border-blue-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {roleLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 lg:p-10 print:p-0">
          <div className="max-w-5xl print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
