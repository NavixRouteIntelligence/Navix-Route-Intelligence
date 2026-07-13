'use client';

import type { RoutePlan } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Route } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { RoutePlanView } from '@/components/optimizer/route-plan-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PriorityBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatDateTime, formatNumber } from '@/lib/utils';

export default function OptimizerPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RoutePlan | null>(null);

  const deliveries = useQuery({
    queryKey: ['deliveries', 'optimizer'],
    queryFn: () => deliveriesApi.list({ pageSize: 100, sort: '-createdAt' }),
  });
  const history = useQuery({ queryKey: ['route-plans', 'history'], queryFn: () => optimizerApi.listPlans({ pageSize: 5 }) });

  const optimize = useMutation({
    mutationFn: () => optimizerApi.optimizeAndWait({ deliveryIds: [...selected] }),
    onSuccess: (res) => {
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['route-plans'] });
      toast({ tone: 'success', title: 'Rota otimizada', description: `Score ${res.data.score}/100` });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Falha ao otimizar', description: e.message }),
  });

  const items = deliveries.data?.data ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Otimizador de rotas" description="Selecione entregas e gere a sequência ótima." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Selecione as entregas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deliveries.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sem entregas"
                description="Cadastre entregas para otimizar."
                action={
                  <Button asChild>
                    <Link href="/deliveries/new">Nova entrega</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {items.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selected.has(d.id)}
                          onChange={() => toggle(d.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{d.address.city}</span>
                          <span className="block text-xs text-muted-foreground">
                            {d.address.street}, {d.address.number}
                          </span>
                        </span>
                        <PriorityBadge priority={d.priority} />
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{selected.size} selecionada(s)</span>
                  <Button
                    variant="accent"
                    disabled={selected.size < 2}
                    loading={optimize.isPending}
                    onClick={() => optimize.mutate()}
                  >
                    <Route className="h-4 w-4" />
                    Otimizar
                  </Button>
                </div>
                {selected.size < 2 && (
                  <p className="text-xs text-muted-foreground">Selecione ao menos 2 entregas para otimizar.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {history.data && history.data.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {history.data.data.map((p) => (
                  <li key={p.id}>
                    <Link href={`/optimizer/${p.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:opacity-80">
                      <div>
                        <p className="font-medium">
                          {p.metrics.stops} paradas · {formatNumber(p.metrics.totalDistanceKm, 1)} km
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{p.score}/100</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Route} title="Nenhuma otimização" description="Gere sua primeira rota otimizada." />
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <div className="space-y-4">
          <h2 className="text-h2">Resultado</h2>
          <RoutePlanView plan={result} />
        </div>
      )}
    </div>
  );
}
