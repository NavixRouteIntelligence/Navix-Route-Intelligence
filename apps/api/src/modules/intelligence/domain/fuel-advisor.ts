import type { FuelAdviceView, FuelUnit, VehicleType } from '@navix/contracts';

/** Consumo e capacidade por tipo (defaults plausíveis; tunáveis por tenant). */
const FUEL: Record<VehicleType, { per100: number; tank: number; unit: FuelUnit }> = {
  bicycle: { per100: 0, tank: 0, unit: 'L' },
  motorcycle: { per100: 3, tank: 15, unit: 'L' },
  car: { per100: 8, tank: 50, unit: 'L' },
  van: { per100: 11, tank: 70, unit: 'L' },
  truck: { per100: 28, tank: 300, unit: 'L' },
};

const SAFETY_MARGIN = 1.2; // reabastecer se a autonomia não cobrir 120% da rota

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Gestão inteligente de combustível (ADR-0025): estima o consumo da rota pelo
 * perfil do veículo e recomenda **abastecimento preventivo** conforme o nível
 * atual e uma margem de segurança. Puro e determinístico.
 */
export function adviseFuel(
  vehicleType: VehicleType,
  distanceKm: number,
  currentFuelPercent?: number,
): FuelAdviceView {
  const spec = FUEL[vehicleType];
  if (spec.per100 === 0) {
    return {
      vehicleType,
      estimatedConsumption: 0,
      unit: spec.unit,
      estimatedRangeKm: null,
      refuelRecommended: false,
      reason: 'Veículo sem combustível (tração humana).',
    };
  }

  const estimatedConsumption = round((distanceKm / 100) * spec.per100);

  if (currentFuelPercent === undefined) {
    const refuel = estimatedConsumption > spec.tank * 0.8;
    return {
      vehicleType,
      estimatedConsumption,
      unit: spec.unit,
      estimatedRangeKm: null,
      refuelRecommended: refuel,
      reason: refuel
        ? 'A rota consome mais de 80% do tanque cheio; abasteça antes de sair.'
        : 'O tanque cheio cobre a rota com folga.',
    };
  }

  const currentLiters = (spec.tank * currentFuelPercent) / 100;
  const estimatedRangeKm = round((currentLiters / spec.per100) * 100, 0);
  const refuel = estimatedRangeKm < distanceKm * SAFETY_MARGIN;
  return {
    vehicleType,
    estimatedConsumption,
    unit: spec.unit,
    estimatedRangeKm,
    refuelRecommended: refuel,
    reason: refuel
      ? `Autonomia atual (~${estimatedRangeKm} km) não cobre a rota (~${round(distanceKm)} km) com margem — abasteça preventivamente.`
      : `Autonomia atual (~${estimatedRangeKm} km) cobre a rota (~${round(distanceKm)} km) com margem.`,
  };
}
