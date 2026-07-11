'use client';

import type { RoutePlan } from '@navix/contracts';
import { AlertTriangle, CheckCircle2, Gauge, MapPin, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
 * IA Insights do Motorista (heurístico) — mesmas regras do app Flutter: economia
 * da rota, paradas restantes, rastreamento e eficiência. Preparado para, no
 * futuro, ser alimentado por um modelo real sem mudar a UI.
 */
function buildInsights(
  plan: RoutePlan | null,
  remaining: number,
  tracking: { active: boolean },
): Insight[] {
  const out: Insight[] = [];

  if (plan && plan.savings.distancePct > 0) {
    out.push({
      id: 'savings',
      icon: TrendingUp,
      tone: 'accent',
      title: 'Rota otimizada economiza distância',
      text: `Ganho de ${formatNumber(plan.savings.distancePct, 0)}% em distância nesta rota.`,
    });
  }
  if (remaining > 0) {
    out.push({
      id: 'remaining',
      icon: MapPin,
      tone: 'primary',
      title: `${remaining} parada(s) restantes`,
      text: 'Siga a sequência sugerida para concluir no menor tempo.',
    });
  }
  if (!tracking.active) {
    out.push({
      id: 'tracking',
      icon: AlertTriangle,
      tone: 'warning',
      title: 'Rastreamento inativo',
      text: 'Compartilhe sua localização para a central acompanhar em tempo real.',
    });
  }
  if (plan) {
    const s = plan.score;
    out.push({
      id: 'score',
      icon: Gauge,
      tone: s >= 80 ? 'success' : s >= 50 ? 'warning' : 'danger',
      title: `Eficiência da rota: ${s}/100`,
      text: s >= 80 ? 'Ótimo equilíbrio entre distância, tempo e janelas.' : 'Há espaço para melhorar — revise prioridades e janelas.',
    });
  }
  if (plan && remaining === 0) {
    out.push({
      id: 'done',
      icon: CheckCircle2,
      tone: 'success',
      title: 'Rota concluída',
      text: 'Todas as paradas foram finalizadas.',
    });
  }
  if (out.length === 0) {
    out.push({
      id: 'ok',
      icon: CheckCircle2,
      tone: 'success',
      title: 'Tudo em dia',
      text: 'Sem alertas na sua operação agora.',
    });
  }
  return out.slice(0, 4);
}

export function DriverInsights({
  plan,
  remaining,
  trackingActive,
}: {
  plan: RoutePlan | null;
  remaining: number;
  trackingActive: boolean;
}) {
  const insights = useMemo(() => buildInsights(plan, remaining, { active: trackingActive }), [plan, remaining, trackingActive]);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          IA Insights
        </CardTitle>
        <p className="text-sm text-muted-foreground">Sugestões para a sua rota agora.</p>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
