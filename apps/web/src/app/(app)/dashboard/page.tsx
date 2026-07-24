'use client';

import type { Delivery, DeliveryStatus } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Fuel,
  Gauge,
  MapPin,
  Navigation,
  Package,
  Route,
  Truck,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { AiInsights } from '@/components/dashboard/ai-insights';
import { PodSummaryCard } from '@/components/dashboard/pod-summary-card';
import { RecentImports } from '@/components/dashboard/recent-imports';
import { RecentPlans } from '@/components/dashboard/recent-plans';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

// Componentes pesados (Mapbox/recharts) carregados sob demanda, sem SSR.
const StatusChart = dynamic(() => import('@/components/charts/status-chart').then((m) => m.StatusChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
const PeriodChart = dynamic(() => import('@/components/dashboard/period-chart').then((m) => m.PeriodChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
const RouteMap = dynamic(() => import('@/components/map/route-map').then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});
import { deliveriesApi } from '@/lib/api/deliveries';
import { fleetApi } from '@/lib/api/fleet';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatNumber } from '@/lib/utils';

const FUEL_L_PER_KM = 0.12; // fator médio de consumo (litros por km) — demo
const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  in_route: 'Em rota',
  delivered: 'Entregue',
  failed: 'Falhou',
  canceled: 'Cancelada',
};

function countByStatus(items: Delivery[]): Record<DeliveryStatus, number> {
  const base: Record<DeliveryStatus, number> = { pending: 0, in_route: 0, delivered: 0, failed: 0, canceled: 0 };
  for (const d of items) base[d.status] += 1;
  return base;
}
function formatMinutes(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  return `${Math.round(min)} min`;
}

export default function DashboardPage() {
  const deliveries = useQuery({ queryKey: ['deliveries', 'dashboard'], queryFn: () => deliveriesApi.list({ pageSize: 100, sort: '-createdAt' }) });
  const vehicles = useQuery({ queryKey: ['vehicles', 'dashboard'], queryFn: () => fleetApi.listVehicles({ pageSize: 100 }) });
  const drivers = useQuery({ queryKey: ['drivers', 'dashboard'], queryFn: () => fleetApi.listDrivers({ pageSize: 100 }) });
  const plans = useQuery({ queryKey: ['route-plans', 'dashboard'], queryFn: () => optimizerApi.listPlans({ pageSize: 100 }) });

  const loading = deliveries.isLoading || vehicles.isLoading || drivers.isLoading || plans.isLoading;
  const error = deliveries.error || vehicles.error || drivers.error || plans.error;

  const deliveryItems = deliveries.data?.data ?? [];
  const planItems = plans.data?.data ?? [];
  const counts = countByStatus(deliveryItems);
  const chartStatus = (Object.keys(STATUS_LABEL) as DeliveryStatus[]).map((s) => ({ name: STATUS_LABEL[s], value: counts[s] }));

  const savedKm = planItems.reduce((acc, p) => acc + p.savings.distanceKm, 0);
  const savedMin = planItems.reduce((acc, p) => acc + p.savings.timeMinutes, 0);
  const optimizedKm = planItems.reduce((acc, p) => acc + p.metrics.totalDistanceKm, 0);
  const avgScore = planItems.length ? Math.round(planItems.reduce((a, p) => a + p.score, 0) / planItems.length) : 0;
  // Ganho médio de otimização (real) — usado nos chips de variação.
  const avgSavingsPct = planItems.length
    ? planItems.reduce((a, p) => a + p.savings.distancePct, 0) / planItems.length
    : 0;
  const savingsDelta = avgSavingsPct > 0 ? { label: `${formatNumber(avgSavingsPct, 0)}%`, positive: true } : undefined;
  const activeVehicles = (vehicles.data?.data ?? []).filter((v) => v.status === 'active').length;
  const activeDrivers = (drivers.data?.data ?? []).filter((d) => d.status === 'active').length;
  const latestPlan = planItems[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua operação logística."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/imports">
                <Upload className="h-4 w-4" />
                Importar
              </Link>
            </Button>
          </>
        }
      />

      {error && <Alert tone="error" title="Não foi possível carregar os dados">Verifique se a API está no ar.</Alert>}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entregas" value={formatNumber(deliveries.data?.meta.total ?? 0)} icon={Package} tone="primary" loading={loading} />
        <StatCard label="Rotas otimizadas" value={formatNumber(plans.data?.meta.total ?? 0)} icon={Route} tone="accent" loading={loading} />
        <StatCard label="Motoristas" value={formatNumber(drivers.data?.meta.total ?? 0)} icon={Users} tone="primary" hint={`${activeDrivers} ativos`} loading={loading} />
        <StatCard label="Veículos" value={formatNumber(vehicles.data?.meta.total ?? 0)} icon={Truck} tone="primary" hint={`${activeVehicles} ativos`} loading={loading} />
        <StatCard label="Economia de combustível" value={`${formatNumber(savedKm * FUEL_L_PER_KM, 1)} L`} icon={Fuel} tone="success" delta={savingsDelta} loading={loading} />
        <StatCard label="Economia de tempo" value={formatMinutes(savedMin)} icon={Clock} tone="warning" loading={loading} />
        <StatCard label="Distância otimizada" value={`${formatNumber(optimizedKm, 1)} km`} icon={Navigation} tone="accent" delta={savingsDelta} loading={loading} />
        <StatCard label="Score médio" value={`${avgScore}/100`} icon={Gauge} tone="warning" loading={loading} />
      </div>

      {/* AI Insights */}
      <AiInsights
        deliveries={deliveryItems}
        plans={planItems}
        fleet={{ activeVehicles, totalVehicles: vehicles.data?.meta.total ?? 0 }}
        loading={loading}
      />

      {/* Desempenho + Timeline */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Desempenho — distância otimizada</CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodChart plans={planItems} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline deliveries={deliveryItems} plans={planItems} />
          </CardContent>
        </Card>
      </div>

      {/* Recentes: Route Optimizer + Import Center */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentPlans plans={planItems} loading={loading} />
        <RecentImports />
      </div>

      {/* Painéis */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Frota" href="/fleet/vehicles" cta="Gerenciar frota">
          <Row icon={<Navigation className="h-4 w-4 text-accent" />} label="Veículos ativos" value={`${activeVehicles} / ${vehicles.data?.meta.total ?? 0}`} />
          <Row icon={<Users className="h-4 w-4 text-primary" />} label="Motoristas ativos" value={`${activeDrivers} / ${drivers.data?.meta.total ?? 0}`} />
        </Panel>
        <Panel title="Entregas" href="/deliveries" cta="Ver entregas">
          <Row icon={<Package className="h-4 w-4 text-muted-foreground" />} label="Pendentes" value={formatNumber(counts.pending)} />
          <Row icon={<Navigation className="h-4 w-4 text-primary" />} label="Em rota" value={formatNumber(counts.in_route)} />
          <Row icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Entregues" value={formatNumber(counts.delivered)} />
        </Panel>
        <Panel title="Rotas preparadas pela IA">
          <Row icon={<Route className="h-4 w-4 text-accent" />} label="Rotas geradas" value={formatNumber(plans.data?.meta.total ?? 0)} />
          <Row icon={<Gauge className="h-4 w-4 text-warning" />} label="Score médio" value={`${avgScore}/100`} />
          <Row icon={<Navigation className="h-4 w-4 text-success" />} label="Km economizados" value={`${formatNumber(savedKm, 1)} km`} />
        </Panel>
      </div>

      {/* Comprovantes de entrega (POD) */}
      <PodSummaryCard />

      {/* Status + Mapa */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entregas por status</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveryItems.length === 0 && !loading ? (
              <EmptyState icon={Package} title="Sem entregas" description="Cadastre entregas para ver a distribuição." />
            ) : (
              <StatusChart data={chartStatus} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Última rota otimizada</CardTitle>
          </CardHeader>
          <CardContent>
            {latestPlan ? (
              <RouteMap stops={latestPlan.stops} />
            ) : (
              <EmptyState icon={MapPin} title="Nenhuma rota" description="Gere uma rota no otimizador para vê-la no mapa." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Panel({ title, href, cta, children }: { title: string; href?: string; cta?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {href && cta && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:opacity-80">
            {cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
