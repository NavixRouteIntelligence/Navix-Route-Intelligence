/**
 * Contratos do contexto Delivery (entregas de última milha).
 * Ver docs/architecture.md §4 e docs/database.md §4. Sem otimização de rotas.
 */

export type DeliveryStatus = 'pending' | 'in_route' | 'delivered' | 'failed' | 'canceled';
export type DeliveryPriority = 'low' | 'normal' | 'high' | 'urgent';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'pending',
  'in_route',
  'delivered',
  'failed',
  'canceled',
];
export const DELIVERY_PRIORITIES: readonly DeliveryPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

/** Endereço completo com coordenadas geográficas (WGS84). */
export interface Address {
  street: string;
  number: string;
  complement?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

/** Janela de entrega (ISO 8601 UTC). */
export interface TimeWindow {
  start: string;
  end: string;
}

/** Representação pública de uma entrega. */
export interface Delivery {
  id: string;
  tenantId: string;
  address: Address;
  priority: DeliveryPriority;
  timeWindow: TimeWindow;
  status: DeliveryStatus;
  driverId: string | null;
  vehicleId: string | null;
  routeId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Tombstone de sincronização: `null` em leituras normais; preenchido apenas no
   * feed de sync incremental quando a entrega foi excluída (soft delete), para o
   * cache offline removê-la localmente. Ver ADR-0020.
   */
  deletedAt: string | null;
}

export interface AddressInput {
  street: string;
  number: string;
  complement?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface TimeWindowInput {
  start: string;
  end: string;
}

export interface CreateDeliveryRequest {
  address: AddressInput;
  priority?: DeliveryPriority;
  timeWindow: TimeWindowInput;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  notes?: string | null;
}

export interface UpdateDeliveryRequest {
  address?: AddressInput;
  priority?: DeliveryPriority;
  timeWindow?: TimeWindowInput;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  notes?: string | null;
}

export interface ChangeDeliveryStatusRequest {
  status: DeliveryStatus;
}
