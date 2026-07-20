import type { DeliveryPriority, DestinationType } from '@navix/contracts';

import { GeoPoint } from './geo-point';

export interface StopTimeWindow {
  start: Date;
  end: Date;
}

/** Demanda de carga (peso + volume). Zerada por padrão (ADR-0022). */
export interface Demand {
  weightKg: number;
  volumeM3: number;
}

export const ZERO_DEMAND: Demand = { weightKg: 0, volumeM3: 0 };

/** Soma duas demandas dimensão a dimensão. */
export function addDemand(a: Demand, b: Demand): Demand {
  return { weightKg: a.weightKg + b.weightKg, volumeM3: a.volumeM3 + b.volumeM3 };
}

/** Parada normalizada usada internamente pelo motor de otimização. */
export interface OptimizationStop {
  id: string;
  point: GeoPoint;
  priority: DeliveryPriority;
  timeWindow: StopTimeWindow | null;
  /** Demanda de carga da parada (ADR-0022). Default: {0,0}. */
  demand: Demand;
  /** Tempo de parada específico (min); null usa o service time global. */
  serviceTimeMinutes: number | null;
  /** Trava de posição da ordem manual (ADR-0063). Ausente/false = livre. */
  locked?: boolean;
  /** Tipo do destino (ADR-0064). Define o tempo de serviço por tipo. */
  destinationType?: DestinationType;
  /**
   * Tempo de serviço típico observado neste local (Inteligência Coletiva, ADR-0065).
   * Tem precedência sobre o default por tipo — dado real vence heurística.
   */
  historicalServiceMinutes?: number;
}

/** Peso numérico de prioridade (maior = mais urgente). */
export function priorityWeight(priority: DeliveryPriority): number {
  switch (priority) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
      return 1;
    default:
      return 2;
  }
}
