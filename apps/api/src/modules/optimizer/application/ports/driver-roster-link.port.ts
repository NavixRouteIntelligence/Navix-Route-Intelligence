/**
 * Tradução login → **ficha** do motorista (ADR-0086), do ponto de vista do
 * Optimizer.
 *
 * O token traz o login; `deliveries.driver_id` e agora `route_plans.driver_id`
 * falam a ficha. Fica atrás de uma porta, e não de uma consulta direta ao
 * Fleet, pelo mesmo motivo dos demais gateways anti-corrupção: o Optimizer não
 * conhece `drivers`, só sabe que existe alguém capaz de traduzir.
 */

/** O que o Optimizer precisa saber de uma ficha: quem é, e como chamá-la. */
export interface RosterDriver {
  id: string;
  name: string;
}

export interface DriverRosterLinkPort {
  /** Ficha do login. `null` para o motorista autônomo, que não tem ficha. */
  driverIdForUser(tenantId: string, userId: string): Promise<string | null>;
  /**
   * Fichas **ativas** do tenant (id e nome) — a quem a distribuição pode
   * entregar trabalho, e quem o painel dela lista (ADR-0101). Lista vazia é
   * resposta legítima, e significa "não há a quem distribuir", nunca erro.
   */
  activeDrivers(tenantId: string): Promise<RosterDriver[]>;
}

export const DRIVER_ROSTER_LINK = Symbol('DRIVER_ROSTER_LINK');
