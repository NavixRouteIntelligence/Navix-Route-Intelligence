import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { OptimizationJobRepositoryPort } from '../../domain/ports/optimization-job-repository.port';
import type { ProcessOptimizationJobUseCase } from '../../application/process-optimization-job.use-case';
import { OptimizationJobWorker } from './optimization-job.worker';
import type { OptimizationJobData } from './bull-optimization-job.queue';

/** DataSource cujo `transaction` só executa o callback com um manager fake. */
function fakeDataSource(): DataSource {
  const manager = { query: jest.fn().mockResolvedValue(undefined) };
  return {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
  } as unknown as DataSource;
}

function fakeJob(data: OptimizationJobData): Job<OptimizationJobData> {
  return { data } as Job<OptimizationJobData>;
}

const config = {} as AppConfigService;
const DATA: OptimizationJobData = { jobId: 'job-1', tenantId: 'tenant-1' };

describe('OptimizationJobWorker.process', () => {
  it('reseta jobs presos e delega ao processor sob o contexto do tenant', async () => {
    const jobs = { resetForRetry: jest.fn().mockResolvedValue(false) } as unknown as OptimizationJobRepositoryPort;
    const processor = { execute: jest.fn().mockResolvedValue(true) } as unknown as ProcessOptimizationJobUseCase;
    const ds = fakeDataSource();

    const worker = new OptimizationJobWorker(config, ds, processor, jobs);
    await worker.process(fakeJob(DATA));

    // resetForRetry é incondicional (no-op p/ job novo; desfaz `running` preso).
    expect(jobs.resetForRetry).toHaveBeenCalledWith('job-1');
    expect(processor.execute).toHaveBeenCalledWith('tenant-1', 'job-1');
    // Estabeleceu app.current_tenant antes de processar (RLS).
    expect(ds.transaction).toHaveBeenCalled();
  });

  it('lança quando o job ainda não está visível (para o BullMQ reenfileirar)', async () => {
    const jobs = { resetForRetry: jest.fn().mockResolvedValue(false) } as unknown as OptimizationJobRepositoryPort;
    // execute=false → job não visível (transação do request ainda não commitou).
    const processor = { execute: jest.fn().mockResolvedValue(false) } as unknown as ProcessOptimizationJobUseCase;

    const worker = new OptimizationJobWorker(config, fakeDataSource(), processor, jobs);

    await expect(worker.process(fakeJob(DATA))).rejects.toThrow(/ainda não visível/);
  });

  it('propaga a ordem reset → execute (undo do running precede o claim)', async () => {
    const calls: string[] = [];
    const jobs = {
      resetForRetry: jest.fn(async () => {
        calls.push('reset');
        return true;
      }),
    } as unknown as OptimizationJobRepositoryPort;
    const processor = {
      execute: jest.fn(async () => {
        calls.push('execute');
        return true;
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    const worker = new OptimizationJobWorker(config, fakeDataSource(), processor, jobs);
    await worker.process(fakeJob(DATA));

    expect(calls).toEqual(['reset', 'execute']);
  });
});
