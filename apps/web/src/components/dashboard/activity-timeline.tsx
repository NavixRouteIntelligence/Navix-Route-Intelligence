'use client';

import type { Delivery, RoutePlan } from '@navix/contracts';
import { Package, Route } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime, formatNumber } from '@/lib/utils';

interface Activity {
  id: string;
  at: string;
  icon: ReactNode;
  title: string;
  description: string;
}

export function ActivityTimeline({ deliveries, plans }: { deliveries: Delivery[]; plans: RoutePlan[] }) {
  const activities = useMemo<Activity[]>(() => {
    const items: Activity[] = [];
    for (const p of plans) {
      items.push({
        id: `plan-${p.id}`,
        at: p.createdAt,
        icon: <Route className="h-4 w-4 text-accent" />,
        title: 'Rota otimizada',
        description: `${p.metrics.stops} paradas · ${formatNumber(p.metrics.totalDistanceKm, 1)} km · score ${p.score}`,
      });
    }
    for (const d of deliveries) {
      items.push({
        id: `del-${d.id}`,
        at: d.createdAt,
        icon: <Package className="h-4 w-4 text-primary" />,
        title: 'Entrega cadastrada',
        description: `${d.address.city} · ${d.address.street}`,
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [deliveries, plans]);

  if (activities.length === 0) {
    return <EmptyState icon={Route} title="Sem atividades" description="As atividades recentes aparecerão aqui." />;
  }

  return (
    <ol className="relative space-y-5 pl-2">
      {activities.map((a, i) => (
        <li key={a.id} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">{a.icon}</span>
            {i < activities.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium">{a.title}</p>
            <p className="truncate text-sm text-muted-foreground">{a.description}</p>
            <p className="text-xs text-muted-foreground/70">{formatDateTime(a.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
