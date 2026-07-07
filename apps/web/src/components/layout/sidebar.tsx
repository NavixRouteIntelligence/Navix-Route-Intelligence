'use client';

import { LayoutDashboard, Package, Route, Truck, Users, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deliveries', label: 'Entregas', icon: Package },
  { href: '/fleet/drivers', label: 'Motoristas', icon: Users },
  { href: '/fleet/vehicles', label: 'Veículos', icon: Truck },
  { href: '/optimizer', label: 'Otimizador', icon: Route },
  { href: '/profile', label: 'Perfil', icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegação principal">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
