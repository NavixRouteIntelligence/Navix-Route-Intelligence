'use client';

import { useQuery } from '@tanstack/react-query';
import { Radio, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { trackingApi } from '@/lib/api/tracking';
import { TRACKING_STATUS } from '@/lib/tracking/status';
import { formatDateTime, formatNumber } from '@/lib/utils';

const FleetMap = dynamic(() => import('@/components/map/fleet-map').then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full" />,
});

const POLL_MS = 8000; // polling; a arquitetura permite trocar por WebSocket/SSE.

export default function TrackingPage() {
  const [live, setLive] = useState(true);

  // Polling isolado no data layer: trocar por SSE/WS é só mudar esta fonte.
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['fleet-positions'],
    queryFn: () => trackingApi.fleetLatest(),
    refetchInterval: live ? POLL_MS : false,
  });

  const positions = data?.data ?? [];
  const enRoute = positions.filter((p) => p.status === 'en_route').length;
  const offline = positions.filter((p) => p.status === 'offline').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rastreamento da frota"
        description="Posição dos motoristas em tempo real."
        action={
          <button
            onClick={() => setLive((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              live ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Radio className={`h-4 w-4 ${live ? 'animate-pulse' : ''}`} />
            {live ? 'Ao vivo' : 'Pausado'}
          </button>
        }
      />

      {error && <Alert tone="error" title="Não foi possível carregar as posições" />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Motoristas" value={positions.length} icon={Users} tone="primary" loading={isLoading} />
        <StatCard label="Em rota" value={enRoute} icon={Radio} tone="success" loading={isLoading} />
        <StatCard label="Offline" value={offline} icon={Users} tone="warning" loading={isLoading} />
      </div>

      {isLoading ? (
        <Skeleton className="h-[460px] w-full" />
      ) : positions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Radio}
              title="Nenhum motorista rastreado"
              description="As posições aparecem aqui quando os motoristas compartilham a localização."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <FleetMap positions={positions} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Motorista</TH>
                    <TH>Status</TH>
                    <TH>Velocidade</TH>
                    <TH>Posição</TH>
                    <TH>Atualizado</TH>
                  </TR>
                </THead>
                <tbody>
                  {positions.map((p) => (
                    <TR key={p.driverId}>
                      <TD className="font-mono text-xs">{p.driverId.slice(0, 8)}</TD>
                      <TD>
                        <Badge tone={TRACKING_STATUS[p.status].tone}>{TRACKING_STATUS[p.status].label}</Badge>
                      </TD>
                      <TD className="text-muted-foreground">
                        {p.speed != null ? `${formatNumber(p.speed, 0)} km/h` : '—'}
                      </TD>
                      <TD className="font-mono text-xs text-muted-foreground">
                        {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                      </TD>
                      <TD className="text-muted-foreground">{formatDateTime(p.recordedAt)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          {dataUpdatedAt > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              Última atualização: {formatDateTime(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
        </>
      )}
    </div>
  );
}
