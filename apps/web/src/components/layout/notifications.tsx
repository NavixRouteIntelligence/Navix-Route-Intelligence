'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Package, Route } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deliveriesApi } from '@/lib/api/deliveries';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatDateTime, formatNumber } from '@/lib/utils';

const SEEN_KEY = 'navix.notifications.seen';

interface Note {
  id: string;
  at: string;
  icon: ReactNode;
  title: string;
  description: string;
}

export function Notifications() {
  const [seen, setSeen] = useState<number>(() =>
    typeof window !== 'undefined' ? Number(window.localStorage.getItem(SEEN_KEY) ?? 0) : 0,
  );

  const plans = useQuery({ queryKey: ['notif', 'plans'], queryFn: () => optimizerApi.listPlans({ pageSize: 5 }) });
  const deliveries = useQuery({ queryKey: ['notif', 'deliveries'], queryFn: () => deliveriesApi.list({ pageSize: 5, sort: '-createdAt' }) });

  const notes = useMemo<Note[]>(() => {
    const items: Note[] = [];
    for (const p of plans.data?.data ?? []) {
      items.push({
        id: `plan-${p.id}`,
        at: p.createdAt,
        icon: <Route className="h-4 w-4 text-accent" />,
        title: 'Rota otimizada',
        description: `${p.metrics.stops} paradas · score ${p.score} · −${formatNumber(p.savings.distancePct, 1)}%`,
      });
    }
    for (const d of deliveries.data?.data ?? []) {
      items.push({
        id: `del-${d.id}`,
        at: d.createdAt,
        icon: <Package className="h-4 w-4 text-primary" />,
        title: 'Entrega cadastrada',
        description: `${d.address.city} · ${d.address.street}`,
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [plans.data, deliveries.data]);

  const unread = notes.filter((n) => new Date(n.at).getTime() > seen).length;

  function onOpenChange(open: boolean) {
    if (open) {
      const now = Date.now();
      if (typeof window !== 'undefined') window.localStorage.setItem(SEEN_KEY, String(now));
      setSeen(now);
    }
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notes.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nada por aqui ainda.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notes.map((n) => (
              <div key={n.id} className="flex gap-3 px-2.5 py-2.5">
                <span className="mt-0.5">{n.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                  <p className="text-xs text-muted-foreground/70">{formatDateTime(n.at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
