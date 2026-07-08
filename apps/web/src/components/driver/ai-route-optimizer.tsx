'use client';

import type { RoutePlan } from '@navix/contracts';
import { useMutation } from '@tanstack/react-query';
import {
  Clock,
  Compass,
  Lightbulb,
  MapPin,
  Navigation,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';
import { optimizerApi } from '@/lib/api/optimizer';
import { computeProfitability, useRouteEconomics } from '@/lib/driver/route-economics';
import { formatNumber } from '@/lib/utils';

const ACTIVE = new Set(['pending', 'in_route']);

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function money(v: number): string {
  return `€ ${formatNumber(v, 2)}`;
}

/** Deep link de navegação turn-by-turn (Google Maps) com a sequência otimizada. */
function mapsUrl(plan: RoutePlan): string {
  const stops = plan.stops;
  if (stops.length === 0) return '#';
  const dest = stops[stops.length - 1];
  const waypoints = stops
    .slice(0, -1)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|');
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    destination: `${dest.latitude},${dest.longitude}`,
  });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function suggestions(plan: RoutePlan, tollConfigured: boolean): string[] {
  const tips: string[] = [];
  if (plan.savings.distanceKm > 0) {
    tips.push(
      `A IA reduziu ${formatNumber(plan.savings.distanceKm, 1)} km (${formatNumber(plan.savings.distancePct, 0)}%) vs. a ordem original — menos combustível, mais lucro.`,
    );
  }
  const late = plan.stops.filter((s) => s.timeWindowRespected === false).length;
  if (late > 0) {
    tips.push(`${late} entrega(s) podem furar a janela — priorize-as ou renegocie o horário.`);
  }
  if (!tollConfigured) {
    tips.push('Configure as portagens da rota para um lucro líquido mais preciso.');
  }
  if (tips.length === 0) {
    tips.push('Rota já otimizada para o melhor equilíbrio entre distância e tempo.');
  }
  return tips;
}

/**
 * "Otimizar Rota com IA" — mesmo motor das Empresas, com foco na rentabilidade
 * do Motorista Autônomo. Otimiza as entregas ativas, mostra métricas e lucro
 * estimado, e integra com o rastreamento e com a rota atual do painel.
 */
export function AiRouteOptimizer({
  onOptimized,
  onStartTracking,
}: {
  onOptimized?: () => void;
  onStartTracking?: () => void;
}) {
  const { toast } = useToast();
  const { economics, setField } = useRouteEconomics();
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [editCosts, setEditCosts] = useState(false);

  const optimize = useMutation({
    mutationFn: async () => {
      const list = await deliveriesApi.list({ pageSize: 200, sort: '-createdAt' });
      const ids = list.data
        .filter((d) => ACTIVE.has(d.status) && d.address.latitude != null && d.address.longitude != null)
        .map((d) => d.id);
      if (ids.length < 2) {
        throw new Error('São necessárias ao menos 2 entregas ativas para otimizar.');
      }
      const res = await optimizerApi.optimizeMine({ deliveryIds: ids });
      return res.data;
    },
    onSuccess: (result) => {
      setPlan(result);
      onOptimized?.();
      toast({
        tone: 'success',
        title: 'Rota otimizada com IA',
        description: `${result.metrics.stops} paradas · score ${result.score}/100`,
      });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Não foi possível otimizar', description: e.message }),
  });

  const profit = plan ? computeProfitability(plan, economics) : null;
  const etaFinish = plan
    ? new Date(Date.now() + plan.metrics.totalTimeMinutes * 60_000).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  function startNavigation() {
    if (!plan) return;
    onStartTracking?.();
    const url = mapsUrl(plan);
    if (typeof window !== 'undefined' && url !== '#') window.open(url, '_blank', 'noopener');
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" aria-hidden />
          Otimizar Rota com IA
        </CardTitle>
        {plan && (
          <Button variant="ghost" size="sm" onClick={() => optimize.mutate()} disabled={optimize.isPending}>
            <RotateCcw className="h-4 w-4" />
            Recalcular
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {!plan ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Calcule a melhor sequência das suas entregas aceitas — otimizada por distância, tempo e janelas de
              entrega — e veja o lucro estimado do dia.
            </p>
            <Button onClick={() => optimize.mutate()} disabled={optimize.isPending}>
              {optimize.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Otimizar Rota com IA
            </Button>
            <p className="text-xs text-muted-foreground">
              Trânsito em tempo real, acidentes e estradas fechadas entram em integrações futuras; portagens já são
              consideradas no lucro quando configuradas.
            </p>
          </div>
        ) : (
          <>
            {/* Navegação: métricas principais */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={Clock} label="ETA (chegada)" value={etaFinish} tone="warning" />
              <Metric icon={Navigation} label="Distância" value={`${formatNumber(plan.metrics.totalDistanceKm, 1)} km`} tone="accent" />
              <Metric icon={Clock} label="Tempo estimado" value={formatMinutes(plan.metrics.totalTimeMinutes)} tone="primary" />
              <Metric icon={MapPin} label="Entregas restantes" value={String(plan.metrics.stops)} tone="primary" />
            </div>

            {/* Rentabilidade */}
            {profit && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="h-4 w-4 text-success" aria-hidden />
                    Rentabilidade estimada
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setEditCosts((v) => !v)}>
                    {editCosts ? 'Fechar' : 'Configurar custos'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Money label="Receita" value={money(profit.revenue)} />
                  <Money label="Combustível/energia" value={`− ${money(profit.fuelCost)}`} />
                  <Money label="Portagens" value={`− ${money(profit.tollCost)}`} />
                  <Money label="Quilómetros" value={`${formatNumber(profit.km, 1)} km`} />
                  <Money label="Tempo total" value={formatMinutes(profit.minutes)} />
                  <Money
                    label="Ganho líquido"
                    value={money(profit.netProfit)}
                    highlight={profit.netProfit >= 0 ? 'pos' : 'neg'}
                  />
                </div>

                {editCosts && (
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
                    <CostField label="Receita/entrega (€)" value={economics.revenuePerDelivery} onChange={(v) => setField('revenuePerDelivery', v)} />
                    <CostField label="Combustível (€/L)" value={economics.fuelPrice} onChange={(v) => setField('fuelPrice', v)} />
                    <CostField label="Consumo (L/100km)" value={economics.consumptionPer100km} onChange={(v) => setField('consumptionPer100km', v)} />
                    <CostField label="Portagens (€)" value={economics.tollCost} onChange={(v) => setField('tollCost', v)} />
                  </div>
                )}
              </div>
            )}

            {/* Sugestões da IA */}
            <div className="rounded-lg bg-primary/5 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Lightbulb className="h-4 w-4" aria-hidden />
                Sugestões da IA
              </h4>
              <ul className="space-y-1.5">
                {suggestions(plan, economics.tollCost > 0).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={startNavigation}>
                <Play className="h-4 w-4" />
                Iniciar Navegação
              </Button>
              <Badge tone="success">Sincronizado com o rastreamento</Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  tone: 'primary' | 'accent' | 'warning';
}) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'warning' ? 'text-warning' : 'text-primary';
  return (
    <div className="rounded-lg border border-border p-3">
      <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden />
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Money({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'pos' | 'neg';
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          highlight === 'pos' ? 'text-success' : highlight === 'neg' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CostField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        step="0.1"
        min="0"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8"
      />
    </label>
  );
}
