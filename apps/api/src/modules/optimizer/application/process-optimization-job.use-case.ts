import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationJob, OptimizationJobStatus } from '@navix/contracts';

import { JOB_EVENTS, type JobEventsPort } from '../domain/ports/job-events.port';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRecord,
  type OptimizationJobRepositoryPort,
} from '../domain/ports/optimization-job-repository.port';
import { OptimizeRouteUseCase } from './optimize-route.use-case';

/**
 * Processa um job de otimização: reusa o solver síncrono (`OptimizeRouteUseCase`)
 * e atualiza o status do job. Roda fora da requisição, dentro de uma transação
 * de tenant estabelecida pela fila (ADR-0007).
 */
@Injectable()
export class ProcessOptimizationJobUseCase {
  constructor(
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
    @Inject(JOB_EVENTS) private readonly events: JobEventsPort,
    private readonly optimize: OptimizeRouteUseCase,
  ) {}

  /** Retorna `false` se o job ainda não está visível (a fila deve reagendar). */
  async execute(tenantId: string, jobId: string): Promise<boolean> {
    const job = await this.jobs.findById(tenantId, jobId);
    if (!job) return false;
    if (job.status !== 'queued') return true; // já processado — idempotente

    // Reivindica de forma atômica (queued → running). Se outro consumidor já
    // assumiu (múltiplas instâncias / reprocessamento), sai sem duplicar (ADR-0041).
    const claimed = await this.jobs.claim(job.id);
    if (!claimed) return true;
    this.events.optimizationJobUpdated(tenantId, this.toView(job, { status: 'running' }));

    try {
      const plan = await this.optimize.execute({ ...job.request, tenantId });
      await this.transition(tenantId, job, { status: 'succeeded', routePlanId: plan.id });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Falha na otimização.';
      await this.transition(tenantId, job, { status: 'failed', error });
    }
    return true;
  }

  private async transition(
    tenantId: string,
    job: OptimizationJobRecord,
    patch: { status: OptimizationJobStatus; routePlanId?: string; error?: string },
  ): Promise<void> {
    await this.jobs.update(job.id, patch);
    this.events.optimizationJobUpdated(tenantId, this.toView(job, patch));
  }

  private toView(
    job: OptimizationJobRecord,
    patch: { status: OptimizationJobStatus; routePlanId?: string; error?: string },
  ): OptimizationJob {
    return {
      jobId: job.id,
      status: patch.status,
      routePlanId: patch.routePlanId ?? null,
      error: patch.error ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
