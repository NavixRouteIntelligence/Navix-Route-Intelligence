import type { AugmentationPoint } from './ports/cost-augmentation.port';

/**
 * Zona de risco (ADR-0024): círculo geográfico com uma penalidade de custo.
 * Uma parada dentro do raio recebe a penalidade como sobretaxa de nó — o
 * otimizador tende a atendê-la cedo/evitá-la conforme o peso.
 */
export interface RiskZone {
  latitude: number;
  longitude: number;
  radiusKm: number;
  /** Penalidade somada ao custo de uma parada dentro da zona. */
  penalty: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distância Haversine (km) — pura, para não acoplar o domínio à infra. */
export function haversineKm(a: AugmentationPoint, b: AugmentationPoint): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Soma das penalidades das zonas que contêm o ponto. */
export function riskSurchargeAt(point: AugmentationPoint, zones: readonly RiskZone[]): number {
  let penalty = 0;
  for (const zone of zones) {
    if (haversineKm(point, zone) <= zone.radiusKm) penalty += zone.penalty;
  }
  return penalty;
}
