import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { OptimizationJobQueuePort } from '../../domain/ports/optimization-job-queue.port';
import { BULL_PREFIX, OPTIMIZATION_QUEUE_NAME, bullConnection } from './bull-connection';

/** Dados carregados por cada job BullMQ — suficientes para reprocessar sozinho. */
export interface OptimizationJobData {
  jobId: string;
  tenantId: string;
}

/**
 * Adaptador **BullMQ** do `OptimizationJobQueuePort` (ADR-0055). Diferente da
 * fila in-process, o job é **persistido no Redis**: sobrevive a reinícios do
 * processo, tem retry com backoff exponencial e redelivery em caso de crash do
 * worker — tudo nativo do BullMQ. O `tenantId` viaja no próprio job, então o
 * worker reprocessa sem precisar varrer o banco entre tenants (o que exigiria
 * furar a RLS).
 *
 * Só é instanciado quando `OPTIMIZER_QUEUE_DRIVER=bullmq` (ver módulo).
 */
@Injectable()
export class BullOptimizationJobQueue implements OptimizationJobQueuePort, OnModuleDestroy {
  private readonly logger = new Logger('OptimizationJobQueue');
  private readonly queue: Queue<OptimizationJobData>;

  constructor(config: AppConfigService) {
    const { jobAttempts, jobBackoffMs } = config.optimizer;
    this.queue = new Queue<OptimizationJobData>(OPTIMIZATION_QUEUE_NAME, {
      connection: bullConnection(config),
      prefix: BULL_PREFIX,
      defaultJobOptions: {
        attempts: jobAttempts,
        backoff: { type: 'exponential', delay: jobBackoffMs },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  enqueue(jobId: string, tenantId: string): void {
    // `jobId` como id do BullMQ torna o enqueue idempotente: reenfileirar o
    // mesmo job (ex.: reotimização) não cria duplicata.
    void this.queue
      .add('optimize', { jobId, tenantId }, { jobId })
      .catch((err) =>
        this.logger.error(
          `Falha ao enfileirar job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
