import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
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
  { label: 'Browse', to: '/browse', icon: Compass, module: 'browse' },
  { label: 'Permissions', to: '/permissions', icon: ShieldCheck, superAdminOnly: true },
];

function formatRoleLabel(role?: string): string {
  if (!role) return 'Staff';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 0) return 'GT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Primary office shell featuring a fixed deep navy (var(--color-sidebar)) sidebar,
 * minimal top bar with breadcrumb and profile menu, and centered content container.
 */
export function AppLayout() {
  const { profile, isSuperAdmin, can, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.module) return can(item.module, 'view');
    return true;
  });

  const activeNav = visibleNavItems.find((item) => location.pathname.startsWith(item.to));
  const isClientDetail =
    location.pathname.startsWith('/clients/') && location.pathname !== '/clients';
  const currentTitle = isClientDetail ? 'Client Profile' : activeNav?.label ?? 'Dashboard';

  const roleLabel = formatRoleLabel(profile?.role);
  const displayName = profile?.fullName || profile?.email || 'Staff Member';
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const renderSidebarContent = (collapsed: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-sidebar text-white select-none">
      <div
        className={`flex h-16 items-center border-b border-white/10 shrink-0 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        <BrandLogo
          variant="light"
          size="md"
          showLabel={!collapsed}
          hideLabelOnMobile={Boolean(onNavigate)}
        />
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {collapsed && !onNavigate && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="w-full flex items-center justify-center rounded-lg px-2 py-2 mb-2 text-slate-400 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                } ${
                  isActive
                    ? 'bg-primary text-white border-l-[3px] border-accent shadow-xs'
                    : 'text-white/85 hover:bg-sidebar-hover hover:text-white border-l-[3px] border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-sky-300'}`}
                    strokeWidth={1.85}
                    aria-hidden="true"
                  />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Bottom User Profile */}
      <div className="border-t border-white/10 px-4 py-4 shrink-0">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            title={collapsed ? `${displayName} (${roleLabel})` : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-white/15"
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page flex">
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 print:hidden transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div
          className={`fixed inset-y-0 left-0 z-30 border-r border-slate-800/60 transition-[width] duration-200 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {renderSidebarContent(sidebarCollapsed)}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full shadow-xl">
            {renderSidebarContent(false, () => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="lg:hidden shrink-0">
              <BrandLogo variant="dark" size="sm" showLabel={false} />
            </div>

            {/* Minimal Breadcrumb & Page Title */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                Global Ties
              </span>
              <ChevronRight
                className="hidden sm:inline h-3.5 w-3.5 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              {isClientDetail && (
                <>
                  <NavLink
                    to="/clients"
                    className="hidden sm:inline text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    Clients
                  </NavLink>
                  <ChevronRight
                    className="hidden sm:inline h-3.5 w-3.5 text-slate-400 shrink-0"
                    aria-hidden="true"
                  />
                </>
              )}
              <span className="font-semibold text-slate-900 truncate">{currentTitle}</span>
            </nav>
          </div>

          {/* Right Profile Menu */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                {initials}
              </span>
              <span className="hidden sm:inline font-medium text-slate-800 max-w-[160px] truncate">
                {displayName}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  profileMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 z-40"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {displayName}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                        isSuperAdmin
                          ? 'bg-blue-50 text-primary'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {roleLabel}
                    </span>
                  </div>
                  {profile?.email && (
                    <p className="mt-0.5 text-xs text-slate-500 truncate">{profile.email}</p>
                  )}
                </div>

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 print:p-0">
          <div className="mx-auto max-w-6xl w-full print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
