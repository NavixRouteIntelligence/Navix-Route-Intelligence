'use client';

import type { RoutePlan } from '@navix/contracts';
import { ArrowRight, Route } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';

/** Rotas recentes do otimizador (id curto, paradas, ganho de distância, score). */
export function RecentPlans({ plans, loading }: { plans: RoutePlan[]; loading?: boolean }) {
  const recent = plans.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Route Optimizer — recentes</CardTitle>
        <Link href="/optimizer" className="inline-flex items-center gap-1 text-sm text-primary hover:opacity-80">
          Otimizar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : recent.length === 0 ? (
          <EmptyState icon={Route} title="Nenhuma rota" description="Gere uma rota no otimizador." />
        ) : (
          recent.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Rota {p.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{p.metrics.stops} paradas</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-accent tabular-nums">
                  −{formatNumber(p.savings.distancePct, 0)}% km
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">Score {p.score}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
