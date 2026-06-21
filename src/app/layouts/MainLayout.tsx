import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  Mail,
  FileText,
  Phone,
  Settings,
  Menu,
  X,
  ChevronRight,
  Bell,
  Search,
  LogOut,
  ShieldCheck,
  DollarSign,
  Receipt,
  Crosshair,
  Inbox,
  UserSearch,
  Globe,
  Wand2,
  UserCircle,
  HeartPulse,
  Flame,
  Link2,
  Layers,
  Shield,
  Palette,
  Ban,
  ShoppingCart,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { useTenants } from '../contexts/TenantContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

import type { User } from '../contexts/AuthContext';

function buildNavGroups(user: User | null, activeServices: string[] = [], isImpersonating = false) {
  const isSuperAdmin = !user || user.role === 'superadmin';
  const services = isSuperAdmin ? activeServices : (user?.enabledServices ?? []);
  const has = (s: string) => services.includes(s as never);

  const groups = isSuperAdmin && !isImpersonating ? [] : [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
  ];

  if (has('crm')) {
    groups.push({
      label: 'CRM',
      items: [
        { name: 'Contacts', href: '/contacts', icon: Users },
        { name: 'Companies', href: '/companies', icon: Building2 },
        { name: 'Deals', href: '/deals', icon: TrendingUp },
      ],
    });
  }

  if (has('proposals')) {
    groups.push({
      label: 'Proposals',
      items: [
        { name: 'All Proposals', href: '/proposals', icon: FileText },
        { name: 'Create Proposal', href: '/proposals/create', icon: FileText },
        { name: 'Brand Settings', href: '/settings/brand', icon: Palette },
        { name: 'Service Pricing', href: '/settings/service-pricing', icon: DollarSign },
      ],
    });
  }

  if (has('finance')) {
    groups.push({
      label: 'Finance',
      items: [
        { name: 'Finance', href: '/finance', icon: Receipt },
      ],
    });
  }

  if (has('email_marketing')) {
    groups.push({
      label: 'Email Marketing',
      items: [
        { name: 'Campaigns', href: '/campaigns', icon: Mail },
        { name: 'Audience Setup', href: '/audience-setup', icon: Users },
        { name: 'Domain Setup', href: '/domain-setup', icon: Globe },
        { name: 'Templates', href: '/templates', icon: FileText },
        { name: 'Suppressions', href: '/suppressions', icon: Ban },
      ],
    });
  }

  if (has('cold_email')) {
    groups.push({
      label: 'Cold Outreach',
      items: [
        { name: 'Sequences', href: '/cold-email/campaigns', icon: Crosshair },
        { name: 'Mailboxes', href: '/cold-email/mailboxes', icon: Inbox },
        { name: 'Prospect Lists', href: '/cold-email/prospects', icon: UserSearch },
        { name: 'Domains', href: '/cold-email/domains', icon: Globe },
        { name: 'Provider', href: '/cold-email/provider-connect', icon: Link2 },
        { name: 'Domain Mgmt', href: '/cold-email/domain-manager', icon: Layers },
        { name: 'Buy Domains', href: '/cold-email/domain-purchase', icon: ShoppingCart },
        { name: 'Auto-Provision', href: '/cold-email/provision', icon: Wand2 },
        { name: 'Personas', href: '/cold-email/personas', icon: UserCircle },
        { name: 'Domain Health', href: '/cold-email/domain-health', icon: HeartPulse },
        { name: 'Warmup', href: '/cold-email/warmup', icon: Flame },
        { name: 'Email Finder', href: '/cold-email/email-finder', icon: Search },
      ],
    });
  }

  if (has('ai_assistant')) {
    groups.push({
      label: 'AI Tools',
      items: [
        { name: 'Call Assistant', href: '/ai-assistant', icon: Phone, badge: 'AI' },
      ],
    });
  }

  if (isSuperAdmin) {
    groups.push({
      label: 'Admin',
      items: [
        { name: 'Client Management', href: '/mcc/tenants', icon: ShieldCheck, badge: 'MCC' },
        { name: 'Plans & Pricing', href: '/mcc/pricing', icon: DollarSign },
        { name: 'SaaS Proposals', href: '/mcc/proposals', icon: FileText },
        { name: 'Proposal Analytics', href: '/mcc/proposals/analytics', icon: TrendingUp },
        { name: 'SaaS Finance', href: '/mcc/finance', icon: Receipt },
      ],
    });
  }

  return groups;
}

const bottomNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

type NavListItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

function NavItem({ item, isActive, onClick }: { item: NavListItem; isActive: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-all ${
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      }`}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-sm">{item.name}</span>
      {item.badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { selectedTenant, stopImpersonation } = useTenants();
  const navigate = useNavigate();
  const isImpersonating = user?.role === 'superadmin' && !!selectedTenant;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">NX</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-sidebar-foreground">NexusHQ</span>
            <div className="text-[10px] text-sidebar-foreground/50 leading-none">
              {user?.role === 'client' ? 'Client Portal' : 'Admin Panel'}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/50 hover:text-sidebar-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Client badge */}
      {user?.role === 'client' && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-[10px] text-primary/70 uppercase tracking-wide font-medium">Signed in as</p>
          <p className="text-sm font-semibold text-primary truncate">{user.tenantName}</p>
        </div>
      )}

      {isImpersonating && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[10px] text-amber-700 uppercase tracking-wide font-medium">Viewing client portal</p>
          <p className="text-sm font-semibold text-amber-950 truncate">{selectedTenant.companyName}</p>
          <button
            onClick={() => {
              stopImpersonation();
              navigate('/mcc/tenants');
              onClose?.();
            }}
            className="mt-2 text-xs font-medium text-amber-800 hover:underline"
          >
            Exit client portal
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {buildNavGroups(user, selectedTenant?.enabledServices ?? [], isImpersonating).map((group, i) => (
          <div key={group.label} className={i > 0 ? 'mt-5' : ''}>
            <div className="px-3 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </span>
            </div>
            {group.items.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                isActive={isActive(item.href)}
                onClick={onClose}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {bottomNav.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={isActive(item.href)}
            onClick={onClose}
          />
        ))}
        <Separator className="my-3 bg-sidebar-border" />
        <div className="flex items-center gap-3 px-3 py-2 group">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {user?.initials ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? 'User'}</div>
            <div className="text-xs text-sidebar-foreground/50 truncate">{user?.role ?? 'Member'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectedTenant, stopImpersonation } = useTenants();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/contacts')) return 'Contacts';
    if (path.startsWith('/companies')) return 'Companies';
    if (path.startsWith('/deals')) return 'Deals';
    if (path.startsWith('/proposals')) return 'Proposals';
    if (path.startsWith('/finance')) return 'Finance';
    if (path.startsWith('/campaigns')) return 'Campaigns';
    if (path.startsWith('/domain-setup')) return 'Domain Setup';
    if (path.startsWith('/templates')) return 'Templates';
    if (path.startsWith('/suppressions')) return 'Suppression List';
    if (path.startsWith('/cold-email/provider-connect')) return 'Connect Email Provider';
    if (path.startsWith('/cold-email/domain-manager')) return 'Domain Management';
    if (path.startsWith('/cold-email/provision')) return 'Auto-Provision';
    if (path.startsWith('/cold-email/personas')) return 'Personas';
    if (path.startsWith('/cold-email/domain-health')) return 'Domain Health';
    if (path.startsWith('/cold-email/warmup')) return 'Warmup Progress';
    if (path.startsWith('/cold-email/campaigns')) return 'Cold Sequences';
    if (path.startsWith('/cold-email/mailboxes')) return 'Mailboxes';
    if (path.startsWith('/cold-email/prospects')) return 'Prospect Lists';
    if (path.startsWith('/cold-email/domains')) return 'Sending Domains';
    if (path.startsWith('/ai-assistant')) return 'AI Call Assistant';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/mcc/proposals')) return 'SaaS Proposals';
    if (path.startsWith('/mcc/finance')) return 'SaaS Finance';
    if (path.startsWith('/mcc/pricing')) return 'Plans & Pricing';
    if (path.startsWith('/mcc/tenants')) return 'Client Management';
    return 'NexusHQ';
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col shadow-sm">
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{getPageTitle()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === 'superadmin' && selectedTenant && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                <Shield className="h-3.5 w-3.5" />
                <span className="font-medium">Viewing {selectedTenant.companyName}</span>
                <button
                  onClick={() => {
                    stopImpersonation();
                    navigate('/mcc/tenants');
                  }}
                  className="font-semibold hover:underline"
                >
                  Exit
                </button>
              </div>
            )}
            <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-background border border-border rounded">⌘K</kbd>
            </button>
            <button onClick={() => window.alert('No unread notifications.')} className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-semibold">
                  {user?.initials ?? 'U'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{user?.name ?? 'User'}</p>
                    <p className="text-xs font-normal text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-[11px] font-normal text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {user?.role === 'superadmin' && selectedTenant && (
                  <DropdownMenuItem
                    onClick={() => {
                      stopImpersonation();
                      navigate('/mcc/tenants');
                    }}
                  >
                    <Shield className="h-4 w-4" />
                    Exit Client Portal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
