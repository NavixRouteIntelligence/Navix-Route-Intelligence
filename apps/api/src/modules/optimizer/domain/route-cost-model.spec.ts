import type { StrategyContext } from './ports/route-optimization-strategy.port';
import { compositeCost, serviceTimeAt } from './route-cost-model';

/** Contexto base 3 nós, caminho aberto, só distância no custo. */
function baseCtx(overrides: Partial<StrategyContext> = {}): StrategyContext {
  const d = [
    [0, 2, 5],
    [2, 0, 4],
    [5, 4, 0],
  ];
  return {
    size: 3,
    distanceMatrix: d,
    timeMatrix: d.map((row) => row.map((v) => v * 2)),
    priorities: [0, 0, 0],
    windows: [null, null, null],
    serviceTimeMinutes: 5,
    hasOrigin: false,
    weights: { distance: 1, timeWindow: 0, priority: 0 },
    ...overrides,
  };
}

describe('compositeCost', () => {
  it('sem campos opcionais: custo = distância percorrida (retrocompatível)', () => {
    expect(compositeCost(baseCtx(), [0, 1, 2])).toBeCloseTo(2 + 4); // 0→1→2
  });

  it('edgeSurcharge (pedágio) entra no custo e pode inverter a escolha', () => {
    const edgeSurcharge = [
      [0, 100, 0],
      [100, 0, 0],
      [0, 0, 0],
    ];
    // 0→1→2 passa pela aresta cara (0-1); 0→2→1 a evita.
    const viaToll = compositeCost(baseCtx({ edgeSurcharge }), [0, 1, 2]);
    const avoidToll = compositeCost(baseCtx({ edgeSurcharge }), [0, 2, 1]);
    expect(avoidToll).toBeLessThan(viaToll);
  });

  it('nodeSurcharge (zona de risco) é somado por nó visitado', () => {
    const base = compositeCost(baseCtx(), [0, 1, 2]);
    const withRisk = compositeCost(baseCtx({ nodeSurcharge: [0, 0, 7] }), [0, 1, 2]);
    expect(withRisk - base).toBeCloseTo(7);
  });

  it('respeita o peso de surcharge', () => {
    const nodeSurcharge = [0, 0, 10];
    const w1 = compositeCost(baseCtx({ nodeSurcharge }), [0, 1, 2]);
    const w2 = compositeCost(
      baseCtx({ nodeSurcharge, weights: { distance: 1, timeWindow: 0, priority: 0, surcharge: 2 } }),
      [0, 1, 2],
    );
    expect(w2 - w1).toBeCloseTo(10); // dobro da sobretaxa de 10
  });
});

describe('serviceTimeAt', () => {
  it('usa o tempo por nó quando presente, senão o global', () => {
    const ctx = baseCtx({ perNodeServiceMinutes: [0, 12, undefined as unknown as number] });
    expect(serviceTimeAt(ctx, 1)).toBe(12);
    expect(serviceTimeAt(ctx, 2)).toBe(5); // cai no global
  });
});
