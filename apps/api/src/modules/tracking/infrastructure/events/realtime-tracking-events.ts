import { Injectable } from '@nestjs/common';
import type { DriverPositionView } from '@navix/contracts';

import { RealtimeHub } from '../../../../shared/realtime/realtime-hub';
import type { TrackingEventsPort } from '../../domain/ports/tracking-events.port';

/** Publica cada nova posição no `RealtimeHub` para consumo em tempo real (SSE). */
@Injectable()
export class RealtimeTrackingEvents implements TrackingEventsPort {
  constructor(private readonly hub: RealtimeHub) {}

  positionUpdated(tenantId: string, position: DriverPositionView): void {
    this.hub.publish(tenantId, { type: 'tracking.position', data: position });
  }
}
