/**
 * Portas do Delivery para as duas informações que ele **não** possui, mas que o
 * rastreamento público precisa (ADR-0082): a chegada estimada (Optimizer) e a
 * posição do veículo (Tracking).
 *
 * Declaradas aqui, na linguagem do Delivery, e implementadas por gateways
 * anti-corrupção — mesmo padrão do `FleetGatewayPort`. Assim o caso de uso
 * público não conhece nem o Optimizer nem o Tracking.
 */

/** Chegada estimada da entrega. `null` quando não há rota que a contenha. */
export interface RouteEtaGatewayPort {
  etaForDelivery(tenantId: string, deliveryId: string): Promise<Date | null>;
}

export const ROUTE_ETA_GATEWAY = Symbol('ROUTE_ETA_GATEWAY');

/** Posição do veículo, reduzida ao mínimo que a página pública mostra. */
export interface VehiclePositionSnapshot {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

export interface VehicleLocationGatewayPort {
  latestForDriver(tenantId: string, driverId: string): Promise<VehiclePositionSnapshot | null>;
}

export const VEHICLE_LOCATION_GATEWAY = Symbol('VEHICLE_LOCATION_GATEWAY');
