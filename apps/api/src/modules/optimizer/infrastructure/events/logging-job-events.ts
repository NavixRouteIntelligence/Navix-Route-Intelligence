import { Injectable, Logger } from '@nestjs/common';
import type { OptimizationJob } from '@navix/contracts';

import type { JobEventsPort } from '../../domain/ports/job-events.port';

/**
 * Implementação atual do `JobEventsPort`: apenas registra a transição (log).
 * Um gateway WebSocket/SSE futuro substitui esta implementação para empurrar as
 * mudanças ao cliente (ADR-0007), sem tocar nos casos de uso.
 */
@Injectable()
export class LoggingJobEvents implements JobEventsPort {
  private readonly logger = new Logger('JobEvents');

  optimizationJobUpdated(tenantId: string, job: OptimizationJob): void {
    this.logger.log(`otimização job=${job.jobId} tenant=${tenantId} → ${job.status}`);
  }
}
