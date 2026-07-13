import { Injectable } from '@nestjs/common';
import type { OptimizationJob } from '@navix/contracts';

import { RealtimeHub } from '../../../../shared/realtime/realtime-hub';
import type { JobEventsPort } from '../../domain/ports/job-events.port';

/**
 * Publica as transições de status do job de otimização no `RealtimeHub` (SSE —
 * ADR-0018), permitindo que o cliente acompanhe em tempo real (com o polling
 * como fallback).
 */
@Injectable()
export class RealtimeJobEvents implements JobEventsPort {
  constructor(private readonly hub: RealtimeHub) {}

  optimizationJobUpdated(tenantId: string, job: OptimizationJob): void {
    this.hub.publish(tenantId, { type: 'optimization.job', data: job });
  }
}
