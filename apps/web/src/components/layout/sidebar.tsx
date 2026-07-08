'use client';

import {
  ChevronsLeft,
  LayoutDashboard,
  Navigation,
  Package,
  Radio,
  Route,
  Truck,
  Upload,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiStore } from '@/components/layout/ui-store';
import { Logo, LogoMark } from '@/components/ui/logo';
import { useAuth } from '@/lib/auth/auth-provider';
import { isDriver } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Navegação administrativa (empresa). */
const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deliveries', label: 'Entregas', icon: Package },
  { href: '/imports', label: 'Importar', icon: Upload },
  { href: '/fleet/drivers', label: 'Motoristas', icon: Users },
  { href: '/fleet/vehicles', label: 'Veículos', icon: Truck },
  { href: '/optimizer', label: 'Otimizador', icon: Route },
  { href: '/tracking', label: 'Rastreamento', icon: Radio },
  { href: '/profile', label: 'Perfil', icon: UserCircle },
];

/** Navegação enxuta do Motorista Autônomo. */
const DRIVER_NAV: NavItem[] = [
  { href: '/driver', label: 'Minha rota', icon: Navigation },
  { href: '/fleet/vehicles', label: 'Meu veículo', icon: Truck },
  { href: '/profile', label: 'Perfil', icon: UserCircle },
];

/** Conteúdo compartilhado (usado no rail desktop e no drawer mobile). */
function NavContent({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegação principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useUiStore();
  const { user } = useAuth();
  const nav = isDriver(user) ? DRIVER_NAV : ADMIN_NAV;

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-0')}>
          {collapsed ? <LogoMark /> : <Logo />}
        </div>
        <NavContent items={nav} collapsed={collapsed} />
        <button
          onClick={toggleCollapsed}
          className="m-3 flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronsLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Recolher'}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-card animate-fade-in">
            <div className="flex h-16 items-center px-5">
              <Logo />
            </div>
            <NavContent items={nav} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
