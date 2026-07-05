import type { DeliveryPriority } from '@navix/contracts';

import { GeoPoint } from './geo-point';

export interface StopTimeWindow {
  start: Date;
  end: Date;
}

/** Parada normalizada usada internamente pelo motor de otimização. */
export interface OptimizationStop {
  id: string;
  point: GeoPoint;
  priority: DeliveryPriority;
  timeWindow: StopTimeWindow | null;
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
