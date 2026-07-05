/**
 * Porta anti-corrupção do Delivery para o contexto Fleet. O Delivery depende
 * desta abstração — nunca dos internals do Fleet (ver docs/architecture.md §4).
 * O adaptador na infraestrutura delega para a API pública do Fleet (FleetLookup).
 */
export interface FleetGatewayPort {
  vehicleExists(tenantId: string, vehicleId: string): Promise<boolean>;
  driverExists(tenantId: string, driverId: string): Promise<boolean>;
}

export const FLEET_GATEWAY = Symbol('FLEET_GATEWAY');
