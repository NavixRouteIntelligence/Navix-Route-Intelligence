import type { DelayRiskView, DelaySeverity } from '@navix/contracts';

import type { RouteSchedule } from './route-scheduler';

function severityOf(minutesLate: number): DelaySeverity {
  if (minutesLate >= 30) return 'high';
  if (minutesLate >= 10) return 'medium';
  return 'low';
}

function mitigationFor(sequence: number, severity: DelaySeverity): string {
  if (severity === 'high') {
    return 'Reprioriza esta parada mais cedo ou realoca para outro veículo/rota.';
  }
  if (severity === 'medium') {
    return 'Antecipa a saída ou reduz o tempo em paradas anteriores; avise o cliente.';
  }
  return sequence <= 1
    ? 'Pequeno atraso; monitore o trânsito no início da rota.'
    : 'Pequeno atraso; recuperável reduzindo folgas nas próximas paradas.';
}

/**
 * Previsão de atrasos (ADR-0025): identifica **antecipadamente** as paradas que
 * devem estourar a janela no cronograma previsto e sugere **mitigações**. Puro —
 * opera sobre o `RouteSchedule` já calculado (que embute trânsito + perfil).
 */
export function analyzeDelays(schedule: RouteSchedule): DelayRiskView[] {
  const risks: DelayRiskView[] = [];
  for (const stop of schedule.stops) {
    if (stop.minutesLate !== null && stop.minutesLate > 0) {
      const severity = severityOf(stop.minutesLate);
      risks.push({
        stopId: stop.id,
        minutesLate: stop.minutesLate,
        severity,
        reason: `Chegada prevista ~${stop.minutesLate} min após o fim da janela (trânsito + tempo acumulado).`,
        mitigation: mitigationFor(stop.sequence, severity),
      });
    }
  }
  return risks;
}
