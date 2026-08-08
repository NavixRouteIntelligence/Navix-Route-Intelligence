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
 * Presets do Modo Economia (ADR-0026, revistos na ADR-0111).
 *
 * ## O que mudou, e por quê
 *
 * `time` pesava `distance: 0.8, timeWindow: 0.5` — reduzia a distância e
 * valorizava a janela, mas **nunca minimizava tempo**, porque a função de custo
 * não tinha termo de duração. Agora tem, e `time` o usa.
 *
 * `tolls` amplificava uma sobretaxa que nunca existia (o provedor de pedágio
 * era `no-op`). Agora pesa o **custo de portagem por trecho**, que só tem
 * efeito quando há pórticos declarados — sem dados, o preset degrada para
 * distância e o plano declara `tollData: 'absent'`.
 *
 * ## Unidades
 *
 * Os termos têm grandezas diferentes — km, minutos, unidade monetária —, então
 * os pesos **não** são comparáveis entre si: `duration: 0.05` não é "menos
 * importante" que `distance: 1`. Cada um converte a sua grandeza para a mesma
 * escala de custo. Um minuto de viagem custa aproximadamente o que custa meio
 * quilómetro rodado a 30 km/h, e é daí que sai a ordem de grandeza abaixo.
 *
 * ## A taxa de câmbio é a decisão, e está declarada
 *
 * O que um preset realmente decide é **quantos quilómetros vale um minuto**.
 * Isso não é detalhe de afinação: com `distance: 0.2, duration: 0.5`, um minuto
 * valia 2,5 km — e num caso real (Lisboa–Cascais–Sintra) "menor tempo" devolvia
 * a rota **mais lenta**, porque poupar 1,2 min custava 7,4 km. Uma escolha
 * defensável, mas não sob esse nome. Cada preset declara a sua taxa abaixo.
 */
export const ECONOMY_PRESETS: Record<EconomyMode, OptimizationWeights> = {
  /**
   * Menor tempo de viagem: a duração medida **decide**, e a distância só
   * desempata (1 min ≈ 10 km). Peso de distância maior faria o modo recusar
   * ganhos reais de tempo por serem "longe demais" — que é o modo a contradizer
   * o próprio nome.
   */
  time: { distance: 0.05, duration: 0.5, timeWindow: 0.5, priority: 0.08 },
  /** Menor consumo: distância é o proxy, e é o mais fiel que existe sem telemetria. */
  fuel: { distance: 1.3, timeWindow: 0.05, priority: 0.03 },
  /** Menor emissão: mesma lógica do consumo. */
  co2: { distance: 1.3, timeWindow: 0.05, priority: 0.03 },
  /** Menor custo de portagem: o valor do troço pesa; a distância segue contando. */
  tolls: { distance: 1, toll: 6, timeWindow: 0.1, priority: 0.05, surcharge: 4 },
};

/**
 * Pesos do objetivo escolhido, com **override do operador** (ADR-0111).
 *
 * `overrides` vem da configuração (`OPTIMIZER_WEIGHTS`), e existe porque a
 * ordem de grandeza certa entre tempo, distância e portagem depende da
 * operação: quem roda em cidade com portagem cara não pondera como quem roda
 * no interior. Os presets são o ponto de partida documentado, não a verdade.
 */
export function weightsFor(
  mode: EconomyMode | undefined,
  overrides?: Partial<Record<EconomyMode | 'balanced', Partial<OptimizationWeights>>>,
): OptimizationWeights {
  const base = mode ? ECONOMY_PRESETS[mode] : BALANCED_WEIGHTS;
  const override = overrides?.[mode ?? 'balanced'];
  return override ? { ...base, ...override } : { ...base };
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
