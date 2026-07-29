import type { ObservationKind, ParkingDifficulty } from '@navix/contracts';

import { aggregateInsight, locationCell, MIN_SAMPLE, type CollectiveObservation } from './collective-insight';

function obs(partial: Partial<CollectiveObservation> & { kind: ObservationKind }): CollectiveObservation {
  return {
    id: Math.random().toString(36).slice(2),
    tenantId: 't1',
    driverId: 'd1',
    cell: '0.000,0.000',
    latitude: 0,
    longitude: 0,
    parkingDifficulty: null,
    serviceMinutes: null,
    accessTip: null,
    // Padrão do fixture: dado medido pelo backend, que é o que agrega (ADR-0088).
    source: 'derived',
    createdAt: new Date(),
    ...partial,
  };
}

function parking(difficulty: ParkingDifficulty): CollectiveObservation {
  return obs({ kind: 'parking', parkingDifficulty: difficulty });
}

describe('locationCell', () => {
  it('arredonda a ~110 m (3 casas)', () => {
    expect(locationCell(-23.550123, -46.633456)).toBe('-23.550,-46.633');
  });
});

describe('aggregateInsight', () => {
  it('não expõe estacionamento abaixo da amostra mínima (privacidade)', () => {
    const insight = aggregateInsight('c', [parking('hard'), parking('hard')]);
    expect(insight.parking).toBeUndefined();
    expect(insight.sampleSize).toBe(2);
  });

  it('expõe a dificuldade modal com amostra suficiente', () => {
    const insight = aggregateInsight('c', [
      parking('hard'),
      parking('hard'),
      parking('moderate'),
    ]);
    expect(insight.parking?.difficulty).toBe('hard');
    expect(insight.parking?.confidence).toBeGreaterThan(0);
    expect(insight.parking?.confidence).toBeLessThanOrEqual(0.95);
  });

  it('desempata pela dificuldade mais severa', () => {
    const insight = aggregateInsight('c', [
      parking('easy'),
      parking('hard'),
      parking('easy'),
      parking('hard'),
    ]);
    expect(insight.parking?.difficulty).toBe('hard');
  });

  it('calcula a mediana do tempo de atendimento com amostra suficiente', () => {
    const insight = aggregateInsight('c', [
      obs({ kind: 'service_time', serviceMinutes: 4 }),
      obs({ kind: 'service_time', serviceMinutes: 6 }),
      obs({ kind: 'service_time', serviceMinutes: 8 }),
    ]);
    expect(insight.typicalServiceMinutes).toBe(6);
  });

  it('deduplica e ordena dicas de acesso por frequência', () => {
    const insight = aggregateInsight('c', [
      obs({ kind: 'access', accessTip: 'Interfone 12' }),
      obs({ kind: 'access', accessTip: 'interfone 12' }),
      obs({ kind: 'access', accessTip: 'Doca dos fundos' }),
    ]);
    expect(insight.accessTips[0]).toBe('Interfone 12');
    expect(insight.accessTips).toHaveLength(2);
  });

  it('MIN_SAMPLE é o piso de exposição', () => {
    expect(MIN_SAMPLE).toBeGreaterThanOrEqual(3);
  });
});

// ADR-0088: o `service_time` que o cliente enviava contava do fim da parada
// anterior — media o ciclo, não o atendimento — e inflava o tempo de serviço do
// otimizador. Fica no banco, mas fora da decisão.
describe('quarentena do corpus contaminado (ADR-0088)', () => {
  const tempo = (minutes: number, source: 'derived' | 'client_cycle') =>
    obs({ kind: 'service_time', serviceMinutes: minutes, source });

  it('ignora o tempo relatado pelo cliente na mediana', () => {
    const insight = aggregateInsight('0.000,0.000', [
      tempo(5, 'derived'),
      tempo(6, 'derived'),
      tempo(7, 'derived'),
      // Ciclo inteiro: se entrasse, puxaria a mediana para cima.
      tempo(40, 'client_cycle'),
      tempo(45, 'client_cycle'),
    ]);

    expect(insight.typicalServiceMinutes).toBe(6);
  });

  it('só com dado contaminado, não há tempo típico a afirmar', () => {
    const insight = aggregateInsight('0.000,0.000', [
      tempo(40, 'client_cycle'),
      tempo(45, 'client_cycle'),
      tempo(50, 'client_cycle'),
    ]);

    expect(insight.typicalServiceMinutes).toBeUndefined();
  });
});
