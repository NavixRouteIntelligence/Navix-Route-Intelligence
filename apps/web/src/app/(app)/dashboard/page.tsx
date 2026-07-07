'use client';

import type { Delivery, DeliveryStatus } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Navigation, Package, Route, TrendingDown, Users } from 'lucide-react';
import Link from 'next/link';

import { StatusChart } from '@/components/charts/status-chart';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { deliveriesApi } from '@/lib/api/deliveries';
import { fleetApi } from '@/lib/api/fleet';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatDateTime, formatNumber } from '@/lib/utils';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  in_route: 'Em rota',
  delivered: 'Entregue',
  failed: 'Falhou',
  canceled: 'Cancelada',
};

function countByStatus(items: Delivery[]): Record<DeliveryStatus, number> {
  const base: Record<DeliveryStatus, number> = {
    pending: 0,
    in_route: 0,
    delivered: 0,
    failed: 0,
    canceled: 0,
  };
  for (const d of items) base[d.status] += 1;
  return base;
}

export default function DashboardPage() {
  const deliveries = useQuery({
    queryKey: ['deliveries', 'dashboard'],
    queryFn: () => deliveriesApi.list({ pageSize: 100, sort: '-createdAt' }),
  });
  const vehicles = useQuery({ queryKey: ['vehicles', 'dashboard'], queryFn: () => fleetApi.listVehicles({ pageSize: 100 }) });
  const drivers = useQuery({ queryKey: ['drivers', 'dashboard'], queryFn: () => fleetApi.listDrivers({ pageSize: 100 }) });
  const plans = useQuery({ queryKey: ['route-plans', 'dashboard'], queryFn: () => optimizerApi.listPlans({ pageSize: 5 }) });

  const loading = deliveries.isLoading || vehicles.isLoading || drivers.isLoading;
  const error = deliveries.error || vehicles.error || drivers.error;

  const items = deliveries.data?.data ?? [];
  const counts = countByStatus(items);
  const chartData = (Object.keys(STATUS_LABEL) as DeliveryStatus[]).map((s) => ({
    name: STATUS_LABEL[s],
    value: counts[s],
  }));
  const activeVehicles = (vehicles.data?.data ?? []).filter((v) => v.status === 'active').length;
  const activeDrivers = (drivers.data?.data ?? []).filter((d) => d.status === 'active').length;
  const lastPlan = plans.data?.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua operação logística."
        action={
          <Button asChild variant="accent">
            <Link href="/optimizer">
              <Route className="h-4 w-4" />
              Otimizar rotas
            </Link>
          </Button>
        }
      />

      {error && (
        <Alert tone="error" title="Não foi possível carregar os dados">
          Verifique se a API está no ar e tente recarregar a página.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entregas" value={formatNumber(deliveries.data?.meta.total ?? 0)} icon={Package} tone="primary" loading={loading} />
        <StatCard label="Em rota" value={formatNumber(counts.in_route)} icon={Navigation} tone="accent" loading={loading} />
        <StatCard label="Entregues" value={formatNumber(counts.delivered)} icon={CheckCircle2} tone="success" loading={loading} />
        <StatCard
          label="Economia (última rota)"
          value={lastPlan ? `${formatNumber(lastPlan.savings.distanceKm, 1)} km` : '—'}
          icon={TrendingDown}
          tone="warning"
          hint={lastPlan ? `Score ${lastPlan.score}/100` : undefined}
          loading={plans.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Entregas por status</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !loading ? (
              <EmptyState icon={Package} title="Sem entregas ainda" description="Cadastre entregas para ver a distribuição." />
            ) : (
              <StatusChart data={chartData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row icon={<Navigation className="h-4 w-4 text-accent" />} label="Veículos ativos" value={`${activeVehicles} / ${vehicles.data?.meta.total ?? 0}`} />
            <Row icon={<Users className="h-4 w-4 text-primary" />} label="Motoristas ativos" value={`${activeDrivers} / ${drivers.data?.meta.total ?? 0}`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Otimizações recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.data && plans.data.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {plans.data.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.metrics.stops} paradas · {formatNumber(p.metrics.totalDistanceKm, 1)} km
                    </p>
                    <p className="text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-success">−{formatNumber(p.savings.distancePct, 1)}%</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {p.score}/100
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Route} title="Nenhuma otimização" description="Rode o otimizador para ver o histórico aqui." />
          )}
        </CardContent>
      </Card>
    </div>
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
