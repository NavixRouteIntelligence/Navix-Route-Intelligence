/**
 * Contratos do transporte em tempo real (SSE — ver ADR-0018). O servidor
 * empurra eventos ao cliente do tenant; o polling permanece apenas como fallback.
 */
import type { OptimizationJob } from './optimizer';
import type { DriverPositionView } from './tracking';

/** Evento em tempo real entregue pelo stream SSE (união discriminada por `type`). */
export type RealtimeEvent =
  | { type: 'tracking.position'; data: DriverPositionView }
  | { type: 'optimization.job'; data: OptimizationJob }
  | { type: 'ping'; data: { at: string } };

export type RealtimeEventType = RealtimeEvent['type'];

/**
 * Resposta do endpoint de ticket de conexão. Como o `EventSource` do navegador
 * não envia cabeçalhos, a conexão SSE é autenticada por um **ticket** curto,
 * obtido com o access token e passado na query do stream.
 */
export interface RealtimeTicket {
  ticket: string;
  /** Segundos até o ticket expirar. */
  expiresIn: number;
}
