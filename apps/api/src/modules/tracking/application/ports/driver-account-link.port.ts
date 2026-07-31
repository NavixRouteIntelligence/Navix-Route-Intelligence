/**
 * Tradução entre os dois identificadores de motorista (ADR-0086).
 *
 * O Tracking **grava** a posição sob o id do `user` — é quem está autenticado
 * transmitindo, e é o único id que existe para o motorista autônomo, que não
 * tem ficha. O resto do sistema, porém, fala o id da **ficha**
 * (`deliveries.driver_id`, a lista da frota, o rastreio público). Esta port é a
 * fronteira onde os dois espaços se encontram.
 *
 * Fica atrás de uma porta (e não de uma consulta direta ao Fleet) pelo mesmo
 * motivo dos demais gateways anti-corrupção: o Tracking não conhece `drivers`,
 * só sabe que existe alguém capaz de traduzir.
 */
export interface DriverAccountLinkPort {
  /** Login da ficha. `null` quando a ficha não tem conta no app. */
  userIdForDriver(tenantId: string, driverId: string): Promise<string | null>;

  /**
   * Fichas de vários logins de uma vez — a visão de frota traduz uma lista
   * inteira, e uma consulta por linha seria N+1 na tela mais quente do produto.
   * Logins sem ficha não aparecem no mapa.
   */
  driverIdsForUsers(tenantId: string, userIds: string[]): Promise<Map<string, string>>;
}

export const DRIVER_ACCOUNT_LINK = Symbol('DRIVER_ACCOUNT_LINK');
