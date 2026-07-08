'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Flag,
  Fuel,
  Gauge,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AiRouteOptimizer } from '@/components/driver/ai-route-optimizer';
import { RouteMap } from '@/components/map/route-map';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';
import { optimizerApi } from '@/lib/api/optimizer';
import { trackingApi } from '@/lib/api/tracking';
import { useAuth } from '@/lib/auth/auth-provider';
import { TRACKING_STATUS } from '@/lib/tracking/status';
import { useShareLocation } from '@/lib/tracking/use-share-location';
import { formatDateTime, formatNumber } from '@/lib/utils';

const FUEL_L_PER_KM = 0.12; // fator médio de consumo (litros por km) — demo

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const share = useShareLocation();

  const myPosition = useQuery({
    queryKey: ['driver-position'],
    queryFn: () => trackingApi.myLatest(),
    refetchInterval: share.sharing ? 8000 : false,
  });
  const trackStatus = myPosition.data?.data?.status ?? 'offline';

  const plans = useQuery({
    queryKey: ['driver-route'],
    queryFn: () => optimizerApi.listPlans({ page: 1, pageSize: 1 }),
  });
  const history = useQuery({
    queryKey: ['driver-history'],
    queryFn: () => deliveriesApi.list({ status: 'delivered', pageSize: 8, sort: '-createdAt' }),
  });

  const plan = plans.data?.data?.[0] ?? null;
  const stops = plan?.stops ?? [];
  const remaining = Math.max(0, stops.length - completed);
  const nextStop = stops[completed] ?? null;
  const consumedKm = completed > 0 ? stops[completed - 1]?.cumulativeDistanceKm ?? 0 : 0;
  const consumedMin = completed > 0 ? stops[completed - 1]?.etaMinutes ?? 0 : 0;
  const remainingKm = plan ? Math.max(0, plan.metrics.totalDistanceKm - consumedKm) : 0;
  const remainingMin = plan ? Math.max(0, (stops[stops.length - 1]?.etaMinutes ?? 0) - consumedMin) : 0;
  const fuelSaved = plan ? plan.savings.distanceKm * FUEL_L_PER_KM : 0;

  const delivered = history.data?.data ?? [];

  function concludeStop() {
    if (remaining <= 0) return;
    setCompleted((c) => c + 1);
    toast({ tone: 'success', title: 'Entrega concluída', description: `Faltam ${remaining - 1} paradas.` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha rota"
        description={`Olá, ${user?.email ?? 'motorista'} — seu resumo de hoje.`}
        action={
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="outline" onClick={() => setRunning(false)}>
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            ) : (
              <Button onClick={() => setRunning(true)} disabled={!plan}>
                <Play className="h-4 w-4" />
                Iniciar rota
              </Button>
            )}
            <Button variant="outline" onClick={concludeStop} disabled={!plan || remaining <= 0}>
              <CheckCircle2 className="h-4 w-4" />
              Concluir entrega
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast({ tone: 'info', title: 'Problema reportado', description: 'A central foi notificada.' })}
            >
              <Flag className="h-4 w-4" />
              Reportar problema
            </Button>
          </div>
        }
      />

      {(plans.error || history.error) && (
        <Alert tone="error" title="Não foi possível carregar seus dados">
          Verifique sua conexão e tente novamente.
        </Alert>
      )}

      {/* Compartilhamento de localização (tracking) */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${TRACKING_STATUS[trackStatus].dot}`} aria-hidden />
            <div>
              <p className="text-sm font-medium">
                Rastreamento: {TRACKING_STATUS[trackStatus].label}
              </p>
              <p className="text-xs text-muted-foreground">
                {share.sharing
                  ? 'Enviando sua localização em tempo real.'
                  : 'Ative para compartilhar sua posição com a central.'}
              </p>
              {share.error && <p className="text-xs text-danger">{share.error}</p>}
            </div>
          </div>
          <Button variant={share.sharing ? 'outline' : 'primary'} onClick={share.toggle}>
            <MapPin className="h-4 w-4" />
            {share.sharing ? 'Parar de compartilhar' : 'Compartilhar localização'}
          </Button>
        </CardContent>
      </Card>

      {/* Otimização inteligente da rota (mesmo motor das Empresas) */}
      <AiRouteOptimizer
        onOptimized={() => qc.invalidateQueries({ queryKey: ['driver-route'] })}
        onStartTracking={() => {
          if (!share.sharing) share.toggle();
        }}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entregas do dia" value={stops.length} icon={RouteIcon} tone="primary" loading={plans.isLoading} />
        <StatCard label="Paradas restantes" value={remaining} icon={MapPin} tone="accent" loading={plans.isLoading} />
        <StatCard label="Tempo estimado" value={plan ? formatMinutes(remainingMin) : '—'} icon={Clock} tone="warning" loading={plans.isLoading} />
        <StatCard label="Distância restante" value={plan ? `${formatNumber(remainingKm, 1)} km` : '—'} icon={Navigation} tone="accent" loading={plans.isLoading} />
        <StatCard label="Economia de combustível" value={plan ? `${formatNumber(fuelSaved, 1)} L` : '—'} icon={Fuel} tone="success" loading={plans.isLoading} />
        <StatCard label="Economia de tempo" value={plan ? formatMinutes(plan.savings.timeMinutes) : '—'} icon={Clock} tone="success" loading={plans.isLoading} />
        <StatCard label="Score de eficiência" value={plan ? `${plan.score}/100` : '—'} icon={Gauge} tone="primary" loading={plans.isLoading} />
        <StatCard label="Concluídas hoje" value={completed} icon={CheckCircle2} tone="success" loading={plans.isLoading} />
      </div>

      {plans.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : !plan ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Truck}
              title="Nenhuma rota atribuída ainda"
              description="Cadastre seu veículo para começar a receber rotas otimizadas."
              action={
                <Button asChild>
                  <Link href="/fleet/vehicles">
                    <Truck className="h-4 w-4" />
                    Cadastrar veículo
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Mapa */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rota atual</CardTitle>
              </CardHeader>
              <CardContent>
                <RouteMap stops={stops} />
              </CardContent>
            </Card>
          </div>

          {/* Próxima parada + sequência */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Próxima parada</CardTitle>
              </CardHeader>
              <CardContent>
                {nextStop ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {nextStop.sequence}
                      </span>
                      <div>
                        <p className="text-sm font-medium">Parada {nextStop.sequence} de {stops.length}</p>
                        <p className="text-xs text-muted-foreground">
                          ETA {formatMinutes(nextStop.etaMinutes)} · {formatNumber(nextStop.cumulativeDistanceKm, 1)} km
                        </p>
                      </div>
                    </div>
                    <Button className="w-full" onClick={concludeStop}>
                      <CheckCircle2 className="h-4 w-4" />
                      Concluir esta parada
                    </Button>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-success">Todas as paradas concluídas! 🎉</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sequência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {stops.map((s, i) => {
                  const done = i < completed;
                  return (
                    <div key={s.deliveryId} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          done ? 'bg-success/15 text-success' : i === completed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {done ? '✓' : s.sequence}
                      </span>
                      <span className={done ? 'text-muted-foreground line-through' : ''}>
                        {formatNumber(s.cumulativeDistanceKm, 1)} km · ETA {formatMinutes(s.etaMinutes)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de entregas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <Skeleton className="m-6 h-32" />
          ) : delivered.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={CheckCircle2} title="Sem entregas concluídas" description="Suas entregas finalizadas aparecerão aqui." />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Endereço</TH>
                  <TH>Cidade</TH>
                  <TH>Status</TH>
                  <TH>Data</TH>
                </TR>
              </THead>
              <tbody>
                {delivered.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.address.street}, {d.address.number}</TD>
                    <TD className="text-muted-foreground">{d.address.city}</TD>
                    <TD>
                      <Badge tone="success">Entregue</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{formatDateTime(d.timeWindow.start)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
