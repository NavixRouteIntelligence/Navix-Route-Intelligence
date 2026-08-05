import { UNREACHABLE, analyzeReachability, hasUnreachableLeg } from './reachability';

/** Matriz simétrica a partir de pares proibidos. */
function matriz(n: number, proibidos: [number, number][] = []): number[][] {
  const m: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j): number => (i === j ? 0 : 10)),
  );
  for (const [a, b] of proibidos) {
    m[a][b] = UNREACHABLE;
    m[b][a] = UNREACHABLE;
  }
  return m;
}

describe('hasUnreachableLeg', () => {
  it('a diagonal (zero) não é trecho proibido', () => {
    expect(hasUnreachableLeg(matriz(3))).toBe(false);
  });

  it('acusa qualquer aresta infinita', () => {
    expect(hasUnreachableLeg(matriz(3, [[0, 2]]))).toBe(true);
  });
});

describe('analyzeReachability', () => {
  it('grafo completo: tudo roteirizável', () => {
    const r = analyzeReachability(matriz(4), false);

    expect(r.routable).toEqual([0, 1, 2, 3]);
    expect(r.unreachable).toEqual([]);
  });

  // Uma parada sem rota para ninguém: costuma ser coordenada errada.
  it('parada sem nenhuma ligação sai como isolada', () => {
    const m = matriz(4, [
      [3, 0],
      [3, 1],
      [3, 2],
    ]);

    const r = analyzeReachability(m, false);

    expect(r.routable).toEqual([0, 1, 2]);
    expect(r.unreachable).toEqual([{ index: 3, reason: 'isolated' }]);
  });

  // Duas ilhas: ninguém está sozinho, mas não há rota que cubra as duas.
  it('componentes separados: fica o maior, o resto sai como desconectado', () => {
    // {0,1,2} de um lado; {3,4} do outro.
    const m = matriz(5, [
      [0, 3],
      [0, 4],
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4],
    ]);

    const r = analyzeReachability(m, false);

    expect(r.routable).toEqual([0, 1, 2]);
    expect(r.unreachable).toEqual([
      { index: 3, reason: 'disconnected' },
      { index: 4, reason: 'disconnected' },
    ]);
  });

  // Com origem, quem manda é ela: o veículo parte dali, e nenhum outro
  // componente é alcançável — mesmo que seja maior.
  it('com origem, fica o componente da origem ainda que menor', () => {
    // Origem {0,1}; do outro lado {2,3,4}.
    const m = matriz(5, [
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);

    const r = analyzeReachability(m, true);

    expect(r.routable).toEqual([0, 1]);
    expect(r.unreachable.map((u) => u.index)).toEqual([2, 3, 4]);
  });

  // Mão única continua sendo ligação: proibir só um sentido não desconecta.
  it('via de mão única não desconecta o grafo', () => {
    const m: number[][] = matriz(3);
    m[0][2] = UNREACHABLE; // só a ida

    const r = analyzeReachability(m, false);

    expect(r.routable).toEqual([0, 1, 2]);
  });

  it('matriz vazia não quebra', () => {
    expect(analyzeReachability([], false)).toEqual({ routable: [], unreachable: [] });
  });
});
