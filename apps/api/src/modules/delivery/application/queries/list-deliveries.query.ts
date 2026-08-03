import type { DeliveryPriority, DeliveryStatus } from '@navix/contracts';

import type { PageParams } from '../../../../shared/kernel/pagination';

export type DeliverySortField = 'createdAt' | 'windowStart' | 'priority';
export type SortDirection = 'ASC' | 'DESC';

export interface DeliverySort {
  field: DeliverySortField;
  direction: SortDirection;
}

export interface DeliveryFilters {
  status?: DeliveryStatus;
  priority?: DeliveryPriority;
  /**
   * Três estados, não dois (ADR-0100):
   *
   * - `undefined` — sem filtro de motorista.
   * - uma ficha — só as entregas daquela ficha.
   * - `null` — só as entregas **sem** motorista atribuído, que são as do
   *   motorista autônomo. Não é sinônimo de "sem filtro": quem escrever
   *   `if (filters.driverId)` devolve o tenant inteiro ao autônomo, que é
   *   exatamente o vazamento que a ADR-0100 fecha.
   */
  driverId?: string | null;
  vehicleId?: string;
  routeId?: string;
  windowFrom?: Date;
  windowTo?: Date;
}

export interface ListDeliveriesQuery {
  page: PageParams;
  filters: DeliveryFilters;
  sort: DeliverySort[];
}

export const ALLOWED_SORT_FIELDS: readonly DeliverySortField[] = [
  'createdAt',
  'windowStart',
  'priority',
];
