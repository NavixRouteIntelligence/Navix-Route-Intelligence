import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { OptimizationJobQueuePort } from '../../domain/ports/optimization-job-queue.port';
import { ProcessOptimizationJobUseCase } from '../../application/process-optimization-job.use-case';

const FIRST_DELAY_MS = 50;
const RETRY_DELAY_MS = 150;
const MAX_ATTEMPTS = 10;

/**
 * Fila **in-process**: agenda o processamento assíncrono no mesmo processo
 * (`setTimeout`, fire-and-forget), estabelecendo uma transação de tenant própria
 * (com `app.current_tenant` para a RLS) — espelhando o `TenantTransactionInterceptor`.
 *
 * Placeholder para BullMQ/worker dedicado (ADR-0007): trocar esta implementação
 * não altera os casos de uso. Não é durável a reinícios do processo — jobs
 * `queued`/`running` órfãos são um follow-up (reaper/persistent queue).
 *
 * O job é criado na transação do request; até ela commitar, o processador pode
 * não enxergá-lo — daí o pequeno atraso inicial + retry quando não encontrado.
 */
@Injectable()
export class InProcessOptimizationJobQueue implements OptimizationJobQueuePort {
  private readonly logger = new Logger('OptimizationJobQueue');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processor: ProcessOptimizationJobUseCase,
  ) {}

  // Assíncrona só para satisfazer o contrato do port (que o driver BullMQ usa
  // de verdade): agendar um `setTimeout` local não tem como falhar, então
  // resolve de imediato. O processamento segue fora da requisição.
  enqueue(jobId: string, tenantId: string): Promise<void> {
    setTimeout(() => {
      void this.run(jobId, tenantId, 0);
    }, FIRST_DELAY_MS);
    return Promise.resolve();
  }

  private async run(jobId: string, tenantId: string, attempt: number): Promise<void> {
    try {
      const processed = await this.dataSource.transaction(async (manager) => {
        await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
        return transactionContext.run(manager, () => this.processor.execute(tenantId, jobId));
      });
      if (!processed && attempt < MAX_ATTEMPTS) {
        setTimeout(() => {
          void this.run(jobId, tenantId, attempt + 1);
        }, RETRY_DELAY_MS);
      }
    } catch (err) {
      this.logger.error(
        `Falha ao processar job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
