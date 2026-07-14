import type { GeoPoint } from './geo-point';
import { addDemand, ZERO_DEMAND, type Demand } from './optimization-stop';

/**
 * Agrupamento de paradas em rotas por veículo (ADR-0022, Fase 2).
 *
 * Heurística de **sweep** (varredura angular): ordena as paradas pelo ângulo
 * polar em torno do centro (a origem/depósito, ou o centroide), e as distribui
 * em ordem angular entre os veículos, respeitando a **capacidade** (peso/volume)
 * e balanceando a contagem (~N/V por veículo). Isso produz clusters **compactos
 * e contíguos** (proximidade geográfica) sem dependências externas —
 * determinístico e testável. O solver ótimo (OR-Tools) é a Fase 4; aqui é a
 * construção que alimenta a otimização por rota (reuso do RouteSolver).
 *
 * Paradas cuja demanda não cabe em nenhum veículo saem em `unassigned`.
 */
export interface PartitionVehicle {
  /** Capacidade do veículo; null = sem restrição. */
  capacity: Demand | null;
}

export interface PartitionStop {
  point: GeoPoint;
  demand: Demand;
}

export interface FleetPartition {
  /** `clusters[v]` = índices de paradas atribuídas ao veículo `v`. */
  clusters: number[][];
  /** Índices de paradas que não couberam em nenhum veículo. */
  unassigned: number[];
}

function fits(load: Demand, add: Demand, cap: Demand | null): boolean {
  if (!cap) return true;
  return (
    load.weightKg + add.weightKg <= cap.weightKg + 1e-9 &&
    load.volumeM3 + add.volumeM3 <= cap.volumeM3 + 1e-9
  );
}

export function partitionByCapacity(
  stops: PartitionStop[],
  vehicles: PartitionVehicle[],
  origin: GeoPoint | null,
): FleetPartition {
  const v = vehicles.length;
  if (v === 0) return { clusters: [], unassigned: stops.map((_, i) => i) };
  if (stops.length === 0) return { clusters: vehicles.map(() => []), unassigned: [] };

  const center = origin
    ? { lat: origin.latitude, lng: origin.longitude }
    : centroid(stops);
  const order = stops
    .map((s, i) => ({ i, angle: Math.atan2(s.point.latitude - center.lat, s.point.longitude - center.lng) }))
    .sort((a, b) => a.angle - b.angle)
    .map((x) => x.i);

  const clusters: number[][] = vehicles.map(() => []);
  const loads: Demand[] = vehicles.map(() => ({ ...ZERO_DEMAND }));
  const unassigned: number[] = [];
  const target = Math.ceil(stops.length / v);
  let sweep = 0; // ponteiro de varredura (mantém contiguidade angular)

  for (const idx of order) {
    const demand = stops[idx].demand;
    const chosen =
      pick(sweep, v, (vi) => clusters[vi].length < target && fits(loads[vi], demand, vehicles[vi].capacity)) ??
      pick(sweep, v, (vi) => fits(loads[vi], demand, vehicles[vi].capacity)) ??
      pick(0, v, (vi) => fits(loads[vi], demand, vehicles[vi].capacity));

    if (chosen === null) {
      unassigned.push(idx);
      continue;
    }
    clusters[chosen].push(idx);
    loads[chosen] = addDemand(loads[chosen], demand);
    if (chosen >= sweep) sweep = chosen;
  }

  return { clusters, unassigned };
}

function pick(from: number, to: number, ok: (vi: number) => boolean): number | null {
  for (let vi = from; vi < to; vi++) if (ok(vi)) return vi;
  return null;
}

function centroid(stops: PartitionStop[]): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  for (const s of stops) {
    lat += s.point.latitude;
    lng += s.point.longitude;
  }
  return { lat: lat / stops.length, lng: lng / stops.length };
}
