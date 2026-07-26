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
  /**
   * Posição de motorista registrada. **Não** dispara reotimização sozinha: é o
   * *tick* que faz o detector de atraso reavaliar a rota (ADR-0083). Posições
   * chegam a cada poucos segundos; reotimizar a cada uma seria insano.
   */
  | 'tracking.position-recorded'
  /** A rota corrente está atrasada além do limiar — aí sim, reotimiza. */
  | 'route.delay-detected';

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
}
