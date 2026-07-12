'use client';

import type { RoutePlan } from '@navix/contracts';
import { Clock, Gauge, MapPin, Route, TrendingDown } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';

const RouteMap = dynamic(() => import('@/components/map/route-map').then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

const FUEL_L_PER_KM = 0.12; // fator médio (L/km) — estimativa
const FUEL_PRICE_PER_L = 6; // R$/L — estimativa

function fmtMin(minutes: number): string {
  const m = Math.round(minutes);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
  }
  return `${m} min`;
}

function CompareBar({ label, before, after, unit, pct }: { label: string; before: number; after: number; unit: string; pct: number }) {
  const ratio = before > 0 ? Math.min(after / before, 1) : 0;
  const dec = unit === 'km' ? 1 : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {pct > 0 && <span className="text-xs font-medium text-accent">−{formatNumber(pct, 0)}%</span>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="w-12 text-xs text-muted-foreground">Antes</span>
          <div className="h-2.5 flex-1 rounded-full bg-muted">
            <div className="h-full rounded-full bg-muted-foreground/60" style={{ width: '100%' }} />
          </div>
          <span className="w-16 text-right text-xs font-medium tabular-nums">{formatNumber(before, dec)} {unit}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 text-xs text-muted-foreground">Depois</span>
          <div className="h-2.5 flex-1 rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(ratio * 100, 4)}%` }} />
          </div>
          <span className="w-16 text-right text-xs font-medium tabular-nums">{formatNumber(after, dec)} {unit}</span>
        </div>
      </div>
    </div>
  );
}

function SaveTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
      <p className="text-xs font-medium text-success">{sub}</p>
    </div>
  );
}

export function RoutePlanView({ plan }: { plan: RoutePlan }) {
  const fuelL = plan.savings.distanceKm * FUEL_L_PER_KM;
  const fuelReais = fuelL * FUEL_PRICE_PER_L;
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

      {/* Antes × Depois + economia */}
      <Card>
        <CardHeader>
          <CardTitle>Antes × Depois</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <CompareBar label="Distância" before={plan.baseline.totalDistanceKm} after={plan.metrics.totalDistanceKm} unit="km" pct={plan.savings.distancePct} />
          <CompareBar label="Tempo" before={plan.baseline.totalTimeMinutes} after={plan.metrics.totalTimeMinutes} unit="min" pct={plan.savings.timePct} />
          <div className="grid grid-cols-2 gap-3">
            <SaveTile label="Combustível" value={`${formatNumber(fuelL, 1)} L`} sub={`≈ R$ ${formatNumber(fuelReais, 0)}`} />
            <SaveTile label="Tempo" value={fmtMin(plan.savings.timeMinutes)} sub={`−${formatNumber(plan.savings.timePct, 0)}%`} />
          </div>
          <p className="text-xs text-muted-foreground">Economia de combustível estimada ({FUEL_L_PER_KM} L/km · R$ {FUEL_PRICE_PER_L}/L).</p>
        </CardContent>
      </Card>

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
