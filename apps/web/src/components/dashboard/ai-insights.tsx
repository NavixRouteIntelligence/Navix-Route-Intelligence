'use client';

import type { Delivery, RoutePlan } from '@navix/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/lib/i18n/locale-provider';
import { formatNumber } from '@/lib/utils';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'accent';

interface Insight {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  text: string;
}

const TONE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/10 text-accent',
};

/**
 * AI Insights (heurístico, sem IA avançada): deriva observações acionáveis dos
 * dados atuais — status das entregas, economia das rotas, eficiência e frota.
 * Estruturado para, no futuro, ser alimentado por um modelo real sem mudar a UI.
 */
function buildInsights(
  deliveries: Delivery[],
  plans: RoutePlan[],
  fleet: { activeVehicles: number; totalVehicles: number },
): Insight[] {
  const out: Insight[] = [];
  const total = deliveries.length;
  const pending = deliveries.filter((d) => d.status === 'pending').length;
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  const delivered = deliveries.filter((d) => d.status === 'delivered').length;

  const savedKm = plans.reduce((a, p) => a + p.savings.distanceKm, 0);
  const savedMin = plans.reduce((a, p) => a + p.savings.timeMinutes, 0);
  const avgScore = plans.length ? Math.round(plans.reduce((a, p) => a + p.score, 0) / plans.length) : 0;

  if (savedKm > 0) {
    out.push({
      id: 'savings',
      icon: TrendingUp,
      tone: 'success',
      title: 'Otimização gerou economia',
      text: `As rotas otimizadas pouparam ${formatNumber(savedKm, 1)} km e ${formatNumber(savedMin, 0)} min no período.`,
    });
  }
  if (pending >= 2) {
    out.push({
      id: 'pending',
      icon: Lightbulb,
      tone: 'primary',
      title: 'Entregas aguardando roteirização',
      text: `${pending} entrega(s) pendentes. Otimize uma rota para reduzir distância e tempo.`,
    });
  }
  if (failed > 0) {
    out.push({
      id: 'failed',
      icon: AlertTriangle,
      tone: 'danger',
      title: 'Entregas com falha',
      text: `${failed} entrega(s) falharam${total ? ` (${formatNumber((failed / total) * 100, 0)}% do total)` : ''}. Investigue as causas para melhorar a taxa de sucesso.`,
    });
  }
  if (avgScore > 0) {
    out.push({
      id: 'score',
      icon: Gauge,
      tone: avgScore >= 75 ? 'success' : avgScore >= 50 ? 'warning' : 'danger',
      title: `Eficiência média das rotas: ${avgScore}/100`,
      text: avgScore >= 75 ? 'Ótimo equilíbrio entre distância, tempo e janelas.' : 'Há espaço para melhorar — revise janelas de entrega e prioridades.',
    });
  }
  if (fleet.totalVehicles > 0) {
    const pct = Math.round((fleet.activeVehicles / fleet.totalVehicles) * 100);
    out.push({
      id: 'fleet',
      icon: Truck,
      tone: pct >= 60 ? 'accent' : 'warning',
      title: `Utilização da frota: ${pct}%`,
      text: `${fleet.activeVehicles} de ${fleet.totalVehicles} veículos ativos.`,
    });
  }
  if (delivered > 0 && total > 0) {
    const rate = Math.round((delivered / total) * 100);
    out.push({
      id: 'rate',
      icon: CheckCircle2,
      tone: 'success',
      title: `Taxa de conclusão: ${rate}%`,
      text: `${delivered} de ${total} entregas concluídas.`,
    });
  }
  return out.slice(0, 5);
}

export function AiInsights({
  deliveries,
  plans,
  fleet,
  loading,
}: {
  deliveries: Delivery[];
  plans: RoutePlan[];
  fleet: { activeVehicles: number; totalVehicles: number };
  loading?: boolean;
}) {
  const { t } = useLocale();
  const insights = useMemo(() => buildInsights(deliveries, plans, fleet), [deliveries, plans, fleet]);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          {t('insights.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('insights.subtitle')}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('insights.empty')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins) => {
              const Icon = ins.icon;
              return (
                <li key={ins.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[ins.tone]}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ins.title}</p>
                    <p className="text-xs text-muted-foreground">{ins.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
