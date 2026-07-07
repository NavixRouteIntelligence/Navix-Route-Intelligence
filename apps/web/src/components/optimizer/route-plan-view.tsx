'use client';

import type { RoutePlan } from '@navix/contracts';
import { Clock, Gauge, MapPin, Route, TrendingDown } from 'lucide-react';

import { RouteMap } from '@/components/map/route-map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';

export function RoutePlanView({ plan }: { plan: RoutePlan }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Distância total" value={`${formatNumber(plan.metrics.totalDistanceKm, 1)} km`} icon={Route} tone="primary" />
        <StatCard label="Tempo estimado" value={`${formatNumber(plan.metrics.totalTimeMinutes, 0)} min`} icon={Clock} tone="accent" />
        <StatCard
          label="Economia"
          value={`${formatNumber(plan.savings.distanceKm, 1)} km`}
          icon={TrendingDown}
          tone="success"
          hint={`−${formatNumber(plan.savings.distancePct, 1)}% vs. ordem original`}
        />
        <StatCard label="Score da rota" value={`${plan.score}/100`} icon={Gauge} tone="warning" hint={`${plan.metrics.stops} paradas`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rota otimizada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{plan.explanation}</p>
          <RouteMap stops={plan.stops} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequência de paradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Coordenadas</TH>
                <TH>Trecho</TH>
                <TH>Acumulado</TH>
                <TH>ETA</TH>
              </TR>
            </THead>
            <tbody>
              {plan.stops.map((s) => (
                <TR key={s.sequence}>
                  <TD>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {s.sequence}
                    </span>
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                    </span>
                  </TD>
                  <TD className="tabular-nums">{formatNumber(s.legDistanceKm, 1)} km</TD>
                  <TD className="tabular-nums">{formatNumber(s.cumulativeDistanceKm, 1)} km</TD>
                  <TD className="tabular-nums">{formatNumber(s.etaMinutes, 0)} min</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
