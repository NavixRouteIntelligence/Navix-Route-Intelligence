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
  driverId?: string;
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
