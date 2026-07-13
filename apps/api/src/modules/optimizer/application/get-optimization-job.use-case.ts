import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationJob } from '@navix/contracts';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRepositoryPort,
} from '../domain/ports/optimization-job-repository.port';
import { toOptimizationJobView } from './optimization-job.mapper';

/** Consulta o status de um job de otimização (polling do cliente). */
@Injectable()
export class GetOptimizationJobUseCase {
  constructor(
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
  ) {}

  async execute(tenantId: string, jobId: string): Promise<OptimizationJob> {
    const job = await this.jobs.findById(tenantId, jobId);
    if (!job) throw new NotFoundError('Job de otimização não encontrado.');
    return toOptimizationJobView(job);
  }
}
