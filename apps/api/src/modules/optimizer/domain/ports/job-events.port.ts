import type { OptimizationJob } from '@navix/contracts';

/**
 * Canal de eventos de job — base para **WebSocket/SSE** futuro. Hoje a
 * implementação apenas registra a transição (log); amanhã, um gateway
 * WebSocket implementa esta port para **empurrar** as mudanças de status ao
 * cliente do tenant, sem alterar os casos de uso (ADR-0007).
 */
export interface JobEventsPort {
  optimizationJobUpdated(tenantId: string, job: OptimizationJob): void;
}

export const JOB_EVENTS = Symbol('JOB_EVENTS');
