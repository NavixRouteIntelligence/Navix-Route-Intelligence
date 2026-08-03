import { partitionByCapacity, type PartitionStop } from './fleet-partitioner';
import type { GeoPoint } from './geo-point';
import { ZERO_DEMAND } from './optimization-stop';

/**
 * Repartição de entregas **entre motoristas** (ADR-0101).
 *
 * Não é um algoritmo novo: é o `partitionByCapacity` da ADR-0022 (varredura por
 * zona, janela e ângulo polar) aplicado a pessoas em vez de veículos. O que
 * muda é só a restrição — e a ausência dela é a decisão que vale registrar.
 *
 * **Motorista não tem capacidade; veículo tem.** O esquema liga a carga ao
 * `vehicles`, e `drivers` não tem coluna de peso ou volume — nem os dois estão
 * ligados entre si. Passar `capacity: null` por motorista é, portanto, o
 * modelo honesto: sem capacidade declarada, a varredura reparte pelo
 * equilíbrio de contagem (~N/V) mantendo cada lote geograficamente compacto,
 * que é exatamente o que se espera de "dividir o dia entre a equipe".
 *
 * A consequência de não haver restrição é útil: **nada sobra**. Com
 * `capacity: null` toda parada cabe em alguém, então `unassigned` só volta
 * cheio no caso em que a resposta certa é mesmo não distribuir — nenhuma ficha
 * ativa. Quando `drivers` e `vehicles` se ligarem, é aqui que a capacidade real
 * entra, sem tocar no particionador.
 */
export interface DistributionStop {
  point: GeoPoint;
  timeWindow?: { start: Date; end: Date } | null;
}

export interface DriverDistribution {
  /** `perDriver[d]` = índices das paradas atribuídas ao motorista `d`. */
  perDriver: number[][];
  /** Índices que ficaram sem dono — hoje, só quando não há motorista algum. */
  unassigned: number[];
}

export function distributeAmongDrivers(
  stops: DistributionStop[],
  driverCount: number,
  origin: GeoPoint | null,
): DriverDistribution {
  const partitionStops: PartitionStop[] = stops.map((s) => ({
    point: s.point,
    // A entrega ainda não carrega peso/volume (ADR-0022): a demanda é zero e a
    // repartição fica sendo por contagem e geografia, não por carga.
    demand: ZERO_DEMAND,
    timeWindow: s.timeWindow ?? null,
  }));

  const drivers = Array.from({ length: driverCount }, () => ({ capacity: null }));
  const { clusters, unassigned } = partitionByCapacity(partitionStops, drivers, origin);
  return { perDriver: clusters, unassigned };
}
