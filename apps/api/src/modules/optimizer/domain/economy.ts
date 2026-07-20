import type { DeliveryPriority, EconomyMode, VehicleType } from '@navix/contracts';

import type { OptimizationWeights } from './ports/route-optimization-strategy.port';

/** Pesos balanceados (comportamento legado, sem Modo Economia). */
export const BALANCED_WEIGHTS: OptimizationWeights = { distance: 1, timeWindow: 0.1, priority: 0.05 };

/**
 * Modo inteligente (ADR-0066): em vez de um preset fixo, **deriva os pesos do
 * contexto** das paradas. Quanto mais paradas têm janela, mais o cumprimento de
 * janela pesa; quanto maior a fração de urgentes/altas, mais a prioridade pesa.
 * Sem janelas nem urgência, cai no balanceado. Combina com o histórico observado
 * (RSE-4) e a classificação de destino (RSE-3), que já entram pelo tempo de serviço.
 */
export function smartWeights(
  stops: readonly { priority: DeliveryPriority; hasTimeWindow: boolean }[],
): OptimizationWeights {
  const n = stops.length || 1;
  const windowShare = stops.filter((s) => s.hasTimeWindow).length / n;
  const urgentShare = stops.filter((s) => s.priority === 'urgent' || s.priority === 'high').length / n;
  const round = (x: number): number => Math.round(x * 100) / 100;
  return {
    distance: 1,
    timeWindow: round(0.1 + windowShare * 0.5), // 0.10 … 0.60
    priority: round(0.05 + urgentShare * 0.25), // 0.05 … 0.30
  };
}

/**
 * Modo Economia (ADR-0026): mapeia o objetivo escolhido em um **preset de pesos**
 * da função de custo compartilhada — sem algoritmo novo. `tolls` amplifica a
 * sobretaxa (o `CostAugmentationPort` de pedágio, ADR-0024); `time` valoriza o
 * cumprimento de janelas; `fuel`/`co2` minimizam distância (proxy de consumo e
 * emissão). A diferenciação fina de **tempo real vs. distância** e o **custo de
 * pedágio por trecho** ganham fidelidade com o provedor de mapas (próximo passo).
 */
export function weightsFor(mode: EconomyMode | undefined): OptimizationWeights {
  switch (mode) {
    case 'time':
      return { distance: 0.8, timeWindow: 0.5, priority: 0.08 };
    case 'fuel':
      return { distance: 1.3, timeWindow: 0.05, priority: 0.03 };
    case 'co2':
      return { distance: 1.3, timeWindow: 0.05, priority: 0.03 };
    case 'tolls':
      return { distance: 1, timeWindow: 0.1, priority: 0.05, surcharge: 4 };
    default:
      return BALANCED_WEIGHTS;
  }
}

// Consumo (L/100km) e fator de emissão (kg CO₂ por litro) por tipo de veículo.
const CONSUMPTION_PER_100KM: Record<VehicleType, number> = {
  bicycle: 0,
  motorcycle: 3,
  car: 8,
  van: 11,
  truck: 28,
};
const CO2_KG_PER_LITER = 2.31; // gasolina/diesel (aprox.)

/** Emissão estimada de CO₂ (kg) para a distância e o tipo de veículo (ADR-0026). */
export function estimateCo2Kg(vehicleType: VehicleType, distanceKm: number): number {
  const liters = (distanceKm / 100) * CONSUMPTION_PER_100KM[vehicleType];
  return Math.round(liters * CO2_KG_PER_LITER * 100) / 100;
}
