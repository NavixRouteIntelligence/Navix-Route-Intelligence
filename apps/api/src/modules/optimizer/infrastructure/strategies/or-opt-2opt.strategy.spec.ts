import { compositeCost } from '../../domain/route-cost-model';
import type { StrategyContext } from '../../domain/ports/route-optimization-strategy.port';
import { NearestNeighbor2OptStrategy } from './nearest-neighbor-2opt.strategy';
import { OrOpt2OptStrategy } from './or-opt-2opt.strategy';

/** Matriz de distâncias euclidianas a partir de pontos 2D. */
function ctxFrom(points: [number, number][]): StrategyContext {
  const n = points.length;
  const d: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
      d[i][j] = d[j][i] = dist;
    }
  }
  return {
    size: n,
    distanceMatrix: d,
    timeMatrix: d,
    priorities: new Array(n).fill(0),
    windows: new Array(n).fill(null),
    serviceTimeMinutes: 0,
    hasOrigin: false,
    weights: { distance: 1, timeWindow: 0, priority: 0 },
  };
}

const points: [number, number][] = [
  [0, 0],
  [1, 5],
  [2, 0],
  [3, 5],
  [4, 0],
  [5, 5],
  [6, 0],
  [7, 5],
];

describe('OrOpt2OptStrategy', () => {
  it('devolve uma permutação válida de todos os nós', () => {
    const { order } = new OrOpt2OptStrategy().optimize(ctxFrom(points));
    expect([...order].sort((a, b) => a - b)).toEqual(points.map((_, i) => i));
  });

  it('nunca é pior que o NN+2-opt (faz 2-opt e ainda Or-opt por cima)', () => {
    const ctx = ctxFrom(points);
    const nn = new NearestNeighbor2OptStrategy().optimize(ctx);
    const vnd = new OrOpt2OptStrategy().optimize(ctx);
    expect(compositeCost(ctx, vnd.order)).toBeLessThanOrEqual(compositeCost(ctx, nn.order) + 1e-9);
  });
});
