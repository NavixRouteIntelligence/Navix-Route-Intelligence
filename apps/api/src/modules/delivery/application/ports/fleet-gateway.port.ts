/**
 * Porta anti-corrupção do Delivery para o contexto Fleet. O Delivery depende
 * desta abstração — nunca dos internals do Fleet (ver docs/architecture.md §4).
 * O adaptador na infraestrutura delega para a API pública do Fleet (FleetLookup).
 */
export interface FleetGatewayPort {
  vehicleExists(tenantId: string, vehicleId: string): Promise<boolean>;
  driverExists(tenantId: string, driverId: string): Promise<boolean>;
  /**
   * Ficha (`drivers.id`) do login autenticado, ou `null` quando o login não tem
   * ficha na frota — o motorista autônomo (ADR-0086). `null` é resposta normal,
   * nunca erro: é ele que identifica o dono das entregas sem motorista.
   */
  driverIdForUser(tenantId: string, userId: string): Promise<string | null>;
}

export const FLEET_GATEWAY = Symbol('FLEET_GATEWAY');
