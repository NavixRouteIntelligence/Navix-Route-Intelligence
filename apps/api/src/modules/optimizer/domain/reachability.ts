/**
 * Trechos sem rota na matriz do provedor (ADR-0106).
 *
 * ## O que estava errado
 *
 * A Matrix API do Mapbox devolve `null` quando **não existe rota** entre dois
 * pontos — uma ilha sem ponte, um endereço do outro lado de um rio, uma
 * coordenada caída no mar. O adaptador traduzia esse `null` para **zero
 * minutos**, o que não é apenas incorreto: é *atraente*. Um trecho de custo
 * zero e duração zero é o mais barato que existe, então o otimizador preferia
 * exatamente as arestas impossíveis.
 *
 * Agora `null` vira `UNREACHABLE` (infinito), e este módulo decide o que fazer
 * com o grafo que sobra.
 */

/** Custo de uma aresta que não existe. Infinito, não zero. */
export const UNREACHABLE = Number.POSITIVE_INFINITY;

/** Por que uma parada ficou de fora — rastreável até o motivo. */
export type UnreachableReason =
  /** Nenhuma outra parada tem rota até ela, em nenhuma direção. */
  | 'isolated'
  /** Tem rota para algumas paradas, mas não para o grupo que a rota atende. */
  | 'disconnected';

export interface UnreachableNode {
  index: number;
  reason: UnreachableReason;
}

export interface ReachabilityReport {
  /** Índices que formam a rota, em ordem crescente. */
  routable: number[];
  /** Índices deixados de fora, com o motivo. */
  unreachable: UnreachableNode[];
}

/** Há alguma aresta impossível na matriz? */
export function hasUnreachableLeg(distance: readonly (readonly number[])[]): boolean {
  return distance.some((row, i) => row.some((v, j) => i !== j && !Number.isFinite(v)));
}

/**
 * Separa o que é roteirizável do que não é.
 *
 * Um par sem rota nos **dois** sentidos desconecta o grafo; ele é considerado
 * ligado quando existe rota em pelo menos uma direção, porque uma via de mão
 * única continua sendo uma ligação real.
 *
 * A rota fica com o componente conexo da **origem**, quando há origem — é dela
 * que o veículo parte, e nenhum outro componente é alcançável a partir dali.
 * Sem origem, fica com o **maior** componente: é o que atende mais entregas.
 * Empate resolve pelo menor índice, para o resultado ser determinístico.
 */
export function analyzeReachability(
  distance: readonly (readonly number[])[],
  hasOrigin: boolean,
): ReachabilityReport {
  const n = distance.length;
  if (n === 0) return { routable: [], unreachable: [] };

  // União-busca sobre as arestas que existem.
  const pai = Array.from({ length: n }, (_, i) => i);
  const raiz = (i: number): number => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  };
  const unir = (a: number, b: number): void => {
    const [ra, rb] = [raiz(a), raiz(b)];
    if (ra !== rb) pai[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  const temLigacao = Array.from({ length: n }, () => false);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Number.isFinite(distance[i][j]) || Number.isFinite(distance[j][i])) {
        unir(i, j);
        temLigacao[i] = true;
        temLigacao[j] = true;
      }
    }
  }

  const componentes = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = raiz(i);
    const grupo = componentes.get(r);
    if (grupo) grupo.push(i);
    else componentes.set(r, [i]);
  }

  const ancora = hasOrigin
    ? raiz(0)
    : [...componentes.entries()].reduce((melhor, atual) =>
        atual[1].length > melhor[1].length ? atual : melhor,
      )[0];

  const routable = componentes.get(ancora) ?? [];
  const unreachable: UnreachableNode[] = [];
  for (let i = 0; i < n; i++) {
    if (raiz(i) === ancora) continue;
    // Sem ligação alguma é diferente de estar noutro grupo: a primeira costuma
    // ser coordenada errada, a segunda é geografia (ilha, rio, ferry).
    unreachable.push({ index: i, reason: temLigacao[i] ? 'disconnected' : 'isolated' });
  }

  return { routable, unreachable };
}
