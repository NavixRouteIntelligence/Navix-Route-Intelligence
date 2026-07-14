import type { CapacityUsage } from '@navix/contracts';

import { addDemand, ZERO_DEMAND, type Demand } from './optimization-stop';

const round = (n: number, d = 3): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Soma a demanda de um conjunto de paradas. */
export function totalDemand(demands: Demand[]): Demand {
  return demands.reduce(addDemand, ZERO_DEMAND);
}

/**
 * Avalia a demanda total contra a capacidade do veículo (ADR-0022). Em uma rota
 * de um único veículo, a viabilidade de capacidade é **independente da ordem**
 * (depende só da soma) — por isso é uma sobrecamada de viabilidade, não um termo
 * do custo. A divisão por veículo respeitando capacidade é a Fase 2 (clustering).
 * `capacity = null` ⇒ sem restrição ⇒ sempre viável.
 */
export function assessCapacity(demand: Demand, capacity: Demand | null): CapacityUsage {
  const capacityKg =
    capacity && Number.isFinite(capacity.weightKg) ? capacity.weightKg : null;
  const capacityVolumeM3 =
    capacity && Number.isFinite(capacity.volumeM3) ? capacity.volumeM3 : null;

  const overWeightKg = capacityKg !== null ? Math.max(0, demand.weightKg - capacityKg) : 0;
  const overVolumeM3 =
    capacityVolumeM3 !== null ? Math.max(0, demand.volumeM3 - capacityVolumeM3) : 0;

  return {
    feasible: overWeightKg === 0 && overVolumeM3 === 0,
    weightKg: round(demand.weightKg),
    volumeM3: round(demand.volumeM3),
    capacityKg: capacityKg !== null ? round(capacityKg) : null,
    capacityVolumeM3: capacityVolumeM3 !== null ? round(capacityVolumeM3) : null,
    overWeightKg: round(overWeightKg),
    overVolumeM3: round(overVolumeM3),
  };
}
