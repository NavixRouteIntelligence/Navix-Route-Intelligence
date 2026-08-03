'use client';

import type { FleetDistribution as FleetDistributionData } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Navigation, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatNumber } from '@/lib/utils';

/**
 * Como o dia está repartido entre os motoristas (ADR-0101).
 *
 * Os números vêm **agregados do servidor**, não de somar as listas paginadas
 * que o dashboard já carrega: é exatamente o defeito que a ADR-0092 corrigiu,
 * onde os totais refletiam só as 100 linhas mais recentes e o erro crescia com
 * o uso.
 *
 * Mostra **todo** motorista ativo, inclusive quem está com zero — um motorista
 * ocioso é o que quem despacha mais precisa enxergar, e ele desapareceria de
 * uma lista montada a partir das entregas.
 */
export function FleetDistribution() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fleet-distribution'],
    queryFn: () => optimizerApi.fleetDistribution(),
  });

  const dist: FleetDistributionData | undefined = data?.data;
  const drivers = dist?.drivers ?? [];
  const semDono = dist?.unassigned ?? 0;
  const maiorCarga = Math.max(1, ...drivers.map((d) => d.pending + d.inRoute));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Distribuição da frota</CardTitle>
        {semDono > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link href="/deliveries">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {semDono} sem motorista
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar a distribuição.</p>
        ) : drivers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum motorista ativo"
            description="Cadastre ou ative um motorista para distribuir as entregas entre a equipe."
          />
        ) : (
          drivers.map((d) => {
            const carga = d.pending + d.inRoute;
            return (
              <div key={d.driverId} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{d.driverName}</p>
                  <p className="shrink-0 text-sm tabular-nums">
                    {carga === 0 ? (
                      <span className="text-muted-foreground">sem entregas</span>
                    ) : (
                      <>
                        <span className="font-semibold">{formatNumber(carga)}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          {carga === 1 ? 'entrega' : 'entregas'}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Barra comparativa: o desequilíbrio entre motoristas é o que
                    se lê de relance, e ele não aparece em números soltos. */}
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(carga / maiorCarga) * 100}%` }}
                  />
                </div>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{formatNumber(d.pending)} pendente(s)</span>
                  <span aria-hidden>·</span>
                  <span>{formatNumber(d.inRoute)} em rota</span>
                  {d.routePlanId ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Navigation className="h-3 w-3" />
                        {d.stops} paradas
                        {d.distanceKm != null && ` · ${formatNumber(d.distanceKm, 1)} km`}
                      </span>
                    </>
                  ) : (
                    carga > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        {/* Sem rota não é erro: uma parada só não forma sequência. */}
                        <span>rota não preparada</span>
                      </>
                    )
                  )}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
