'use client';

import type { DelayRiskAlert, DriverPositionView } from '@navix/contracts';
import { AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

type Tone = 'warning' | 'danger';
interface Alert {
  id: string;
  tone: Tone;
  text: string;
}

/**
 * Alertas operacionais (heurístico) derivados das últimas posições: motorista
 * parado (em rota com velocidade ~0) e GPS instável (sem atualização há >90s).
 */
export function buildTrackingAlerts(positions: DriverPositionView[], nameOf: (id: string) => string): Alert[] {
  const now = Date.now();
  const out: Alert[] = [];
  for (const p of positions) {
    const ageS = (now - new Date(p.recordedAt).getTime()) / 1000;
    const online = p.status !== 'offline';
    const stopped = p.status === 'en_route' && (p.speed ?? 0) < 2;
    const stale = online && ageS > 90;
    if (stopped) out.push({ id: `stop-${p.driverId}`, tone: 'warning', text: `${nameOf(p.driverId)} está parado.` });
    else if (stale) out.push({ id: `gps-${p.driverId}`, tone: 'danger', text: `GPS de ${nameOf(p.driverId)} instável.` });
  }
  return out;
}

/**
 * Alertas **preditivos** de estouro de janela (ADR-0091).
 *
 * Entram no mesmo painel dos operacionais de propósito: para quem despacha, o
 * que importa é "o que exige atenção agora", não de qual subsistema veio o
 * aviso. A diferença aparece no texto — estes trazem a probabilidade e a folga,
 * porque a decisão de reordenar depende de quanto ainda dá para recuperar.
 *
 * Um alerta por entrega: a avaliação se repete a cada ciclo enquanto o risco
 * persistir, e sem a deduplicação por id o painel encheria de repetições.
 */
export function buildRiskAlerts(
  risks: DelayRiskAlert[],
  nameOf: (id: string) => string,
): Alert[] {
  const porEntrega = new Map<string, DelayRiskAlert>();
  for (const risk of risks) porEntrega.set(risk.deliveryId, risk);

  return [...porEntrega.values()].map((risk) => {
    const quem = risk.driverId ? nameOf(risk.driverId) : 'Entrega sem motorista';
    const chance = Math.round(risk.probability * 100);
    const folga =
      risk.slackMinutes < 0
        ? `já ${Math.abs(risk.slackMinutes)} min além da janela`
        : `restam ${risk.slackMinutes} min de folga`;
    return {
      id: `risk-${risk.deliveryId}`,
      tone: risk.severity === 'high' ? ('danger' as const) : ('warning' as const),
      text: `${quem}: ${chance}% de risco de estourar a janela — ${folga}.`,
    };
  });
}

export function TrackingAlerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  return (
    <Card className="border-warning/30">
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          <p className="text-sm font-medium">{alerts.length} alerta(s)</p>
        </div>
        <ul className="space-y-1.5">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${a.tone === 'danger' ? 'bg-danger' : 'bg-warning'}`} aria-hidden />
              {a.text}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
