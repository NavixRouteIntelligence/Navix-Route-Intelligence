/**
 * Eventos de domínio internos (in-process). Diferente do `RealtimeHub` (ADR-0018),
 * que empurra eventos para os **clientes** via SSE, este barramento propaga
 * eventos **entre módulos do backend** — ex.: o Optimizer reage a mudanças de
 * entrega para reotimizar automaticamente (ADR-0023).
 */
export type DomainEventType =
  | 'delivery.created'
  | 'delivery.updated'
  | 'delivery.status-changed'
  | 'delivery.deleted'
  | 'finance.entry-created'
  | 'finance.entry-deleted'
  /**
   * Posição de motorista registrada. **Não** dispara reotimização sozinha: é o
   * *tick* que faz o detector de atraso reavaliar a rota (ADR-0083). Posições
   * chegam a cada poucos segundos; reotimizar a cada uma seria insano.
   */
  | 'tracking.position-recorded'
  /** A rota corrente está atrasada além do limiar — aí sim, reotimiza. */
  | 'route.delay-detected'
  /**
   * Plano de rota persistido. Existe para o read model de KPIs (ADR-0092): a
   * economia de km nasce aqui, e sem este evento o rollup do dia só se
   * atualizaria na próxima mudança de entrega — um atraso sem motivo.
   *
   * **Não** entra nos gatilhos de reotimização, por razão óbvia: reotimizar em
   * resposta a um plano recém-criado seria um laço infinito.
   */
  | 'route.plan-created';

/**
 * Eventos que indicam mudança relevante no plano de rota.
 *
 * `tracking.position-recorded` está fora de propósito (ver acima); quem entra é
 * o `route.delay-detected`, já filtrado pelo detector.
 */
export const REOPTIMIZATION_TRIGGERS: readonly DomainEventType[] = [
  'delivery.created',
  'delivery.updated',
  'delivery.status-changed',
  'delivery.deleted',
  'route.delay-detected',
];

export interface DomainEvent {
  type: DomainEventType;
  /** ID do agregado afetado (ex.: deliveryId). */
  aggregateId: string;
  /**
   * Dia do read model afetado, em UTC (`YYYY-MM-DD`).
   *
   * Eventos que não alimentam projeções podem omitir. Guardar o dia no evento
   * evita recalcular "hoje" para uma alteração retroativa e também elimina a
   * corrida do debounce ao atravessar a meia-noite.
   */
  affectedDay?: string;
}
