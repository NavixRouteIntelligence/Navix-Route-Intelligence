/**
 * Tradução login → **ficha** do motorista (ADR-0086), do ponto de vista do
 * Optimizer.
 *
 * O token traz o login; `deliveries.driver_id` e agora `route_plans.driver_id`
 * falam a ficha. Fica atrás de uma porta, e não de uma consulta direta ao
 * Fleet, pelo mesmo motivo dos demais gateways anti-corrupção: o Optimizer não
 * conhece `drivers`, só sabe que existe alguém capaz de traduzir.
 */
export interface DriverRosterLinkPort {
  /** Ficha do login. `null` para o motorista autônomo, que não tem ficha. */
  driverIdForUser(tenantId: string, userId: string): Promise<string | null>;
}

export const DRIVER_ROSTER_LINK = Symbol('DRIVER_ROSTER_LINK');
