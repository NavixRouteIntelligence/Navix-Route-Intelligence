import type { DriverPositionView } from '@navix/contracts';

/**
 * Canal de eventos de tracking — base do tempo real (SSE, ADR-0018). A
 * implementação publica no `RealtimeHub`; poderia ser trocada sem tocar no caso
 * de uso.
 */
export interface TrackingEventsPort {
  positionUpdated(tenantId: string, position: DriverPositionView): void;
}

export const TRACKING_EVENTS = Symbol('TRACKING_EVENTS');
