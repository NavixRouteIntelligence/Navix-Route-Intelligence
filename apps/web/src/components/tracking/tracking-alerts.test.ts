import type { DelayRiskAlert } from '@navix/contracts';
import { describe, expect, it } from 'vitest';

import { buildRiskAlerts } from './tracking-alerts';

const nomes: Record<string, string> = { 'ficha-1': 'Maria Souza' };
const nameOf = (id: string): string => nomes[id] ?? `Motorista ${id}`;

function risco(over: Partial<DelayRiskAlert> = {}): DelayRiskAlert {
  return {
    deliveryId: 'entrega-1',
    driverId: 'ficha-1',
    severity: 'medium',
    probability: 0.45,
    slackMinutes: 12,
    predictedArrival: '2026-07-31T10:00:00.000Z',
    windowEnd: '2026-07-31T10:12:00.000Z',
    samples: 40,
    ...over,
  };
}

describe('buildRiskAlerts', () => {
  it('mostra a chance e a folga, que é o que decide reordenar', () => {
    const [alerta] = buildRiskAlerts([risco()], nameOf);

    expect(alerta.text).toBe(
      'Maria Souza: 45% de risco de estourar a janela — restam 12 min de folga.',
    );
    expect(alerta.tone).toBe('warning');
  });

  it('risco alto vira tom de perigo', () => {
    const [alerta] = buildRiskAlerts([risco({ severity: 'high', probability: 0.85 })], nameOf);

    expect(alerta.tone).toBe('danger');
    expect(alerta.text).toContain('85%');
  });

  it('folga negativa é dita como já estourada', () => {
    const [alerta] = buildRiskAlerts([risco({ slackMinutes: -8, severity: 'high' })], nameOf);

    expect(alerta.text).toContain('já 8 min além da janela');
  });

  // A avaliação repete a cada ciclo enquanto o risco persistir; sem dedup o
  // painel encheria de repetições da mesma entrega.
  it('mantém só o aviso mais recente de cada entrega', () => {
    const alertas = buildRiskAlerts(
      [risco({ probability: 0.4 }), risco({ probability: 0.9, severity: 'high' })],
      nameOf,
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0].text).toContain('90%');
  });

  it('entregas diferentes geram avisos diferentes', () => {
    const alertas = buildRiskAlerts(
      [risco(), risco({ deliveryId: 'entrega-2' })],
      nameOf,
    );

    expect(alertas).toHaveLength(2);
    expect(new Set(alertas.map((a) => a.id)).size).toBe(2);
  });

  it('entrega sem motorista atribuído não vira "Motorista null"', () => {
    const [alerta] = buildRiskAlerts([risco({ driverId: null })], nameOf);

    expect(alerta.text).toContain('Entrega sem motorista');
  });

  it('sem risco, sem alerta', () => {
    expect(buildRiskAlerts([], nameOf)).toEqual([]);
  });
});
