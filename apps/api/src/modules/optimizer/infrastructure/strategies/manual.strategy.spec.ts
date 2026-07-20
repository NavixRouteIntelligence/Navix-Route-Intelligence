import { StrategyRegistry } from '../../application/strategy-registry';
import type { StrategyContext } from '../../domain/ports/route-optimization-strategy.port';
import { ManualStrategy } from './manual.strategy';

/** Contexto mínimo — a estratégia manual só olha `size`. */
function ctx(size: number): StrategyContext {
  const zeros = Array.from({ length: size }, () => new Array(size).fill(0));
  return {
    size,
    distanceMatrix: zeros,
    timeMatrix: zeros,
    priorities: new Array(size).fill(1),
    windows: new Array(size).fill(null),
    serviceTimeMinutes: 5,
    hasOrigin: false,
    weights: { distance: 1, timeWindow: 0.1, priority: 0.05 },
  };
}

describe('ManualStrategy', () => {
  const strategy = new ManualStrategy();

  it('preserva a ordem informada (identidade)', () => {
    expect(strategy.optimize(ctx(4)).order).toEqual([0, 1, 2, 3]);
  });

  it('mantém a origem (nó 0) em primeiro quando há origem', () => {
    const c = { ...ctx(3), hasOrigin: true };
    expect(strategy.optimize(c).order[0]).toBe(0);
  });

  it('lida com o mínimo de paradas', () => {
    expect(strategy.optimize(ctx(2)).order).toEqual([0, 1]);
  });

  it('nunca reordena — nenhuma parada é perdida nem duplicada', () => {
    const order = strategy.optimize(ctx(10)).order;
    expect([...order].sort((a, b) => a - b)).toEqual([...order]);
    expect(new Set(order).size).toBe(10);
  });

  it('é selecionável no StrategyRegistry por nome', () => {
    const registry = new StrategyRegistry([strategy]);
    expect(registry.get('manual')).toBe(strategy);
  });
});
