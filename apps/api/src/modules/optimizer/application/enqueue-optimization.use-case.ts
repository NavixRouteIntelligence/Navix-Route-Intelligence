import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationJobAccepted } from '@navix/contracts';

import { newId } from '../../../shared/kernel/id';
import {
  OPTIMIZATION_JOB_QUEUE,
  type OptimizationJobQueuePort,
} from '../domain/ports/optimization-job-queue.port';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRepositoryPort,
  type OptimizationJobRequest,
} from '../domain/ports/optimization-job-repository.port';

export interface EnqueueOptimizationCommand extends OptimizationJobRequest {
  tenantId: string;
}

/**
 * Enfileira uma otimização: persiste um job `queued` (na transação de tenant do
 * request) e agenda o processamento assíncrono. Responde imediatamente com o
 * `jobId` — o solver roda fora da requisição (ADR-0007).
 */
@Injectable()
export class EnqueueOptimizationUseCase {
  constructor(
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
    @Inject(OPTIMIZATION_JOB_QUEUE) private readonly queue: OptimizationJobQueuePort,
  ) {}

  async execute(command: EnqueueOptimizationCommand): Promise<OptimizationJobAccepted> {
    const { tenantId, ...request } = command;
    const jobId = newId();
    await this.jobs.create({
      id: jobId,
      tenantId,
      status: 'queued',
      request,
      routePlanId: null,
      error: null,
    });
    // Aguardado de propósito: se o agendamento falhar, a exceção sobe e a
    // transação do request desfaz o job recém-criado. Sem isso o cliente
    // receberia 202 com um jobId que nunca sairia de `queued` (ADR-0081).
    await this.queue.enqueue(jobId, tenantId);
    return { jobId, status: 'queued' };
  }
}
