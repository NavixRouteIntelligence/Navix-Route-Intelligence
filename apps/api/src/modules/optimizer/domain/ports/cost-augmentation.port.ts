/**
 * Fonte de **sobretaxas de custo** por aresta/nó (ADR-0024): pedágios e zonas de
 * risco. Preenche o *seam* já existente no `StrategyContext`/`route-cost-model`
 * (`edgeSurcharge`/`nodeSurcharge`), permitindo que a otimização **evite**
 * trechos com pedágio ou paradas em áreas de risco — sem tocar as estratégias.
 *
 * O adaptador padrão é no-op (retrocompatível). Provedores reais (dados de mapas
 * para pedágio; zonas de risco configuradas) implementam esta port.
 */
export interface AugmentationPoint {
  latitude: number;
  longitude: number;
}

export interface CostAugmentationInput {
  /** Pontos por nó, alinhados aos índices do `StrategyContext` (0 = origem). */
  points: AugmentationPoint[];
  /** Preferência do veículo por evitar pedágios (ex.: camião não; moto sim). */
  avoidTolls: boolean;
}

export interface CostAugmentation {
  /** Sobretaxa por aresta (ex.: pedágio ao percorrer o trecho). */
  edgeSurcharge?: number[][];
  /** Sobretaxa por nó visitado (ex.: parada em zona de risco). */
  nodeSurcharge?: number[];
}

export interface CostAugmentationPort {
  augment(input: CostAugmentationInput): CostAugmentation;
}

export const COST_AUGMENTATION = Symbol('COST_AUGMENTATION');
