/**
 * Porta anti-corrupção do Finance para o contexto Delivery (ADR-0069). Conta
 * entregas concluídas num intervalo — base do lucro/entrega. O adaptador delega
 * para a API pública do Delivery (DeliveryLookup).
 */
export interface DeliveryCountPort {
  countDeliveredInRange(tenantId: string, from: Date, to: Date): Promise<number>;
}

export const DELIVERY_COUNT = Symbol('DELIVERY_COUNT');
