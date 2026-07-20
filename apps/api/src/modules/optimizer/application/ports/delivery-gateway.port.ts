import type { DeliveryPriority, DestinationType, TimeWindow } from '@navix/contracts';

export interface OptimizerDeliveryStop {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
  /** Tipo do destino classificado a partir do endereço (ADR-0064). */
  destinationType?: DestinationType;
}

/**
 * Porta anti-corrupção do Optimizer para o contexto Delivery. O adaptador na
 * infraestrutura delega para a API pública do Delivery (DeliveryLookup).
 */
export interface DeliveryGatewayPort {
  getStops(tenantId: string, ids: string[]): Promise<OptimizerDeliveryStop[]>;
  /** Entregas ativas do tenant (para reotimização automática — ADR-0023). */
  listActiveStops(tenantId: string): Promise<OptimizerDeliveryStop[]>;
}

export const DELIVERY_GATEWAY = Symbol('DELIVERY_GATEWAY');
