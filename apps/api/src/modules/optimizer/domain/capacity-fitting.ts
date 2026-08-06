import type { Demand } from './optimization-stop';
import { priorityWeight } from './optimization-stop';

/**
 * O que cabe no veículo, e o que sobra (ADR-0109).
 *
 * A rota de **um** veículo carregava tudo o que lhe fosse dado e apenas marcava
 * `capacity.feasible = false`. O plano saía plausível e impossível: o motorista
 * descobria na doca que não cabe. Aqui o excesso vira parada **não atribuída**,
 * que é a mesma saída que o caminho de frota já usa quando falta espaço.
 *
 * A ordem de corte é por prioridade — quem é urgente entra primeiro —, e o
 * desempate é a ordem recebida, para o resultado ser determinístico. Não é a
 * escolha ótima: seria um problema de mochila em duas dimensões, e resolver
 * isso a bem de escolher *o que deixar para trás* é otimizar a decisão errada.
 * Quem decide o que fica é quem despacha; o motor só precisa não mentir.
 */
export interface CapacityFit<T> {
  kept: T[];
  /** Paradas que não couberam, na ordem original. */
  dropped: T[];
}

export function fitWithinCapacity<T extends { demand: Demand; priority: string }>(
  stops: readonly T[],
  capacity: Demand | null,
): CapacityFit<T> {
  if (!capacity) return { kept: [...stops], dropped: [] };

  const porPrioridade = stops
    .map((stop, ordem) => ({ stop, ordem }))
    .sort(
      (a, b) =>
        priorityWeight(b.stop.priority as never) - priorityWeight(a.stop.priority as never) ||
        a.ordem - b.ordem,
    );

  const keptIdx = new Set<number>();
  let peso = 0;
  let volume = 0;
  for (const { stop, ordem } of porPrioridade) {
    const novoPeso = peso + stop.demand.weightKg;
    const novoVolume = volume + stop.demand.volumeM3;
    // Uma parada que sozinha não cabe nunca entra — e não bloqueia as
    // seguintes, que podem ser menores.
    if (novoPeso > capacity.weightKg || novoVolume > capacity.volumeM3) continue;
    keptIdx.add(ordem);
    peso = novoPeso;
    volume = novoVolume;
  }

  const kept: T[] = [];
  const dropped: T[] = [];
  stops.forEach((stop, i) => (keptIdx.has(i) ? kept : dropped).push(stop));
  return { kept, dropped };
}
