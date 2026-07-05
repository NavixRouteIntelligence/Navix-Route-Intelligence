import type { StrategyContext } from '../../domain/ports/route-optimization-strategy.port';
import { NearestNeighbor2OptStrategy } from './nearest-neighbor-2opt.strategy';

type Point = [number, number];

function euclid(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function buildContext(points: Point[]): StrategyContext {
  const size = points.length;
  const distanceMatrix = points.map((p) => points.map((q) => euclid(p, q)));
  return {
    size,
    distanceMatrix,
    timeMatrix: distanceMatrix, // 1 unidade = 1 min para o teste
    priorities: new Array(size).fill(0),
    windows: new Array(size).fill(null),
    serviceTimeMinutes: 0,
    hasOrigin: false,
    weights: { distance: 1, timeWindow: 0, priority: 0 },
  };
}

function pathDistance(order: number[], matrix: number[][]): number {
  let d = 0;
  for (let i = 1; i < order.length; i++) d += matrix[order[i - 1]][order[i]];
  return d;
}

describe('NearestNeighbor2OptStrategy', () => {
  const strategy = new NearestNeighbor2OptStrategy();

  // Quadrado apresentado numa ordem que se cruza: identidade é ruim.
  const points: Point[] = [
    [0, 0],
    [10, 10],
    [10, 0],
    [0, 10],
  ];

  it('retorna uma permutação válida (todos os nós, uma vez)', () => {
    const { order } = strategy.optimize(buildContext(points));
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('não piora a distância em relação à ordem recebida', () => {
    const ctx = buildContext(points);
    const { order } = strategy.optimize(ctx);
    const baseline = pathDistance([0, 1, 2, 3], ctx.distanceMatrix);
    const optimized = pathDistance(order, ctx.distanceMatrix);
    expect(optimized).toBeLessThanOrEqual(baseline + 1e-9);
    expect(optimized).toBeLessThan(baseline); // neste caso melhora de fato
  });

  it('mantém a origem fixa na posição 0 quando hasOrigin', () => {
    const ctx = { ...buildContext(points), hasOrigin: true };
    const { order } = strategy.optimize(ctx);
    expect(order[0]).toBe(0);
  });
});
