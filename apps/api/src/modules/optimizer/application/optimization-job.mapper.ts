import type { OptimizationJob } from '@navix/contracts';

import type { OptimizationJobRecord } from '../domain/ports/optimization-job-repository.port';

export function toOptimizationJobView(record: OptimizationJobRecord): OptimizationJob {
  return {
    jobId: record.id,
    status: record.status,
    routePlanId: record.routePlanId,
    error: record.error,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
