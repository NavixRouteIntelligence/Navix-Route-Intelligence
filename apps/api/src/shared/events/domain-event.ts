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
  | 'delivery.deleted';

/** Conjunto de eventos que indicam mudança relevante no plano de rota. */
export const REOPTIMIZATION_TRIGGERS: readonly DomainEventType[] = [
  'delivery.created',
  'delivery.updated',
  'delivery.status-changed',
  'delivery.deleted',
];

export interface DomainEvent {
  type: DomainEventType;
  /** ID do agregado afetado (ex.: deliveryId). */
  aggregateId: string;
}
