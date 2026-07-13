'use client';

import type { DriverPositionView } from '@navix/contracts';
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
