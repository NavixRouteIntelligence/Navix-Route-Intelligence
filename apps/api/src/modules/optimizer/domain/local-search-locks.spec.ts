import { initialOrder, orOptImprove, preservesLocks, twoOptImprove } from './local-search';
import type { StrategyContext } from './ports/route-optimization-strategy.port';

/**
 * Matriz de distância em linha reta (nós numa reta 0..n-1). A ordem ótima
 * irrestrita é a crescente [0,1,2,...]. Embaralhamos a entrada para que a
 * otimização TENHA o que reordenar — e verificamos que as travas ficam de pé.
 */
function lineCtx(order: number[], locked?: boolean[]): StrategyContext {
  const size = order.length;
  const pos = order; // order[i] = coordenada do nó i na reta
  const distanceMatrix = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => Math.abs(pos[i] - pos[j])),
  );
  return {
    size,
    distanceMatrix,
    timeMatrix: distanceMatrix,
    priorities: new Array(size).fill(1),
    windows: new Array(size).fill(null),
    serviceTimeMinutes: 0,
    hasOrigin: false,
    weights: { distance: 1, timeWindow: 0, priority: 0 },
    ...(locked ? { locked } : {}),
  };
}

describe('local-search — travas de posição (ADR-0063)', () => {
  describe('preservesLocks', () => {
    it('sem travas, qualquer ordem passa', () => {
      expect(preservesLocks([2, 0, 1], undefined)).toBe(true);
    });
    it('exige o nó travado k na posição k', () => {
      const locked = [false, true, false];
      expect(preservesLocks([0, 1, 2], locked)).toBe(true);
      expect(preservesLocks([1, 0, 2], locked)).toBe(false); // nó 1 saiu da posição 1
    });
  });

  describe('initialOrder', () => {
    it('parte da identidade quando há travas', () => {
      const ctx = lineCtx([2, 0, 1], [false, true, false]);
      expect(initialOrder(ctx)).toEqual([0, 1, 2]);
    });
    it('sem travas, usa a construção gulosa (não é forçado à identidade)', () => {
      // Nós na reta em posições 5,0,1,2 → o guloso a partir de 0 não é [0,1,2,3].
      const ctx = lineCtx([5, 0, 1, 2]);
      const order = initialOrder(ctx);
      expect(new Set(order).size).toBe(4); // permutação válida
    });
  });

  it('2-opt mantém a parada travada na sua posição', () => {
    // Coordenadas: nó0=0, nó1=3, nó2=1, nó3=2. Ótimo livre: 0,2,3,1.
    // Travamos o nó1 na posição 1 → ele não pode sair de lá.
    const locked = [false, true, false, false];
    const ctx = lineCtx([0, 3, 1, 2], locked);
    const out = twoOptImprove(ctx, initialOrder(ctx), Date.now() + 500);
    expect(out[1]).toBe(1); // nó travado permanece na posição 1
    expect(preservesLocks(out, locked)).toBe(true);
    expect(new Set(out).size).toBe(4); // nenhuma parada perdida/duplicada
  });

  it('Or-opt respeita as travas ao reposicionar segmentos', () => {
    const locked = [false, false, true, false, false];
    const ctx = lineCtx([4, 0, 2, 1, 3], locked);
    const out = orOptImprove(ctx, initialOrder(ctx), Date.now() + 500);
    expect(out[2]).toBe(2); // nó 2 travado na posição 2
    expect(preservesLocks(out, locked)).toBe(true);
    expect(new Set(out).size).toBe(5);
  });

  it('todas travadas ⇒ a ordem enviada é preservada (identidade)', () => {
    const locked = [true, true, true, true];
    const ctx = lineCtx([3, 1, 2, 0], locked);
    const out = twoOptImprove(ctx, initialOrder(ctx), Date.now() + 500);
    expect(out).toEqual([0, 1, 2, 3]);
  });

  it('livres ainda otimizam ao redor das âncoras', () => {
    // nó0 travado em 0; restante livre. Coordenadas 0, 9, 1, 2 → livres devem
    // ordenar para 0,2,3,1 (posições das coords 0,1,2,9), com nó0 fixo em 0.
    const locked = [true, false, false, false];
    const ctx = lineCtx([0, 9, 1, 2], locked);
    const out = twoOptImprove(ctx, initialOrder(ctx), Date.now() + 500);
    expect(out[0]).toBe(0);
    expect(preservesLocks(out, locked)).toBe(true);
  });
});
