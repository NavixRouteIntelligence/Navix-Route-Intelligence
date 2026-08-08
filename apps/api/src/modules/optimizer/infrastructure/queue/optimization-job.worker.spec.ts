import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { OptimizationJobRepositoryPort } from '../../domain/ports/optimization-job-repository.port';
import type { ProcessOptimizationJobUseCase } from '../../application/process-optimization-job.use-case';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
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

const config = { optimizer: { jobAttempts: 3 } } as AppConfigService;
const DATA: OptimizationJobData = { jobId: 'job-1', tenantId: 'tenant-1' };

/** Métricas são efeito colateral aqui: o que se testa é o processamento. */
function metricsStub() {
  return {
    observeQueueJobFailure: jest.fn(),
    observeQueueError: jest.fn(),
  } as unknown as OptimizerMetrics;
}

describe('OptimizationJobWorker.process', () => {
  it('reseta jobs presos e delega ao processor sob o contexto do tenant', async () => {
    const jobs = {
      resetForRetry: jest.fn().mockResolvedValue(false),
    } as unknown as OptimizationJobRepositoryPort;
    const processor = {
      execute: jest.fn().mockResolvedValue(true),
    } as unknown as ProcessOptimizationJobUseCase;
    const ds = fakeDataSource();

    const worker = new OptimizationJobWorker(config, ds, processor, jobs, metricsStub());
    await worker.process(fakeJob(DATA));

    // resetForRetry é incondicional (no-op p/ job novo; desfaz `running` preso).
    expect(jobs.resetForRetry).toHaveBeenCalledWith('job-1');
    expect(processor.execute).toHaveBeenCalledWith('tenant-1', 'job-1');
    // Estabeleceu app.current_tenant antes de processar (RLS).
    expect(ds.transaction).toHaveBeenCalled();
  });

  it('lança quando o job ainda não está visível (para o BullMQ reenfileirar)', async () => {
    const jobs = {
      resetForRetry: jest.fn().mockResolvedValue(false),
    } as unknown as OptimizationJobRepositoryPort;
    // execute=false → job não visível (transação do request ainda não commitou).
    const processor = {
      execute: jest.fn().mockResolvedValue(false),
    } as unknown as ProcessOptimizationJobUseCase;

    const worker = new OptimizationJobWorker(
      config,
      fakeDataSource(),
      processor,
      jobs,
      metricsStub(),
    );

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

    const worker = new OptimizationJobWorker(
      config,
      fakeDataSource(),
      processor,
      jobs,
      metricsStub(),
    );
    await worker.process(fakeJob(DATA));

    expect(calls).toEqual(['reset', 'execute']);
  });
});

// NAV-4.14 / ADR-0114: uma tentativa que falhou é ruído; a última é uma rota que
// ninguém vai receber — e antes ela deixava o job em `running` para sempre.
describe('OptimizationJobWorker — job que esgota as tentativas', () => {
  function jobFalho(attemptsMade: number, attempts = 3): Job<OptimizationJobData> {
    return { data: DATA, attemptsMade, opts: { attempts } } as Job<OptimizationJobData>;
  }

  /** `onFailed` é o listener do evento 'failed'; acessado direto no teste. */
  function chamarOnFailed(worker: OptimizationJobWorker, job: Job<OptimizationJobData>) {
    return (worker as unknown as { onFailed: (j: unknown, e: Error) => Promise<void> }).onFailed(
      job,
      new Error('Mapbox fora do ar'),
    );
  }

  it('com tentativas restantes, não fecha o job: o BullMQ vai reenfileirar', async () => {
    const jobs = { update: jest.fn() } as unknown as OptimizationJobRepositoryPort;
    const metrics = metricsStub();
    const worker = new OptimizationJobWorker(
      config,
      fakeDataSource(),
      {} as ProcessOptimizationJobUseCase,
      jobs,
      metrics,
    );

    await chamarOnFailed(worker, jobFalho(1));

    expect(jobs.update).not.toHaveBeenCalled();
    expect(metrics.observeQueueJobFailure).toHaveBeenCalledWith('optimization', 'retrying');
  });

  it('esgotadas as tentativas, marca o job como falho com a causa', async () => {
    const jobs = {
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as OptimizationJobRepositoryPort;
    const metrics = metricsStub();
    const worker = new OptimizationJobWorker(
      config,
      fakeDataSource(),
      {} as ProcessOptimizationJobUseCase,
      jobs,
      metrics,
    );

    await chamarOnFailed(worker, jobFalho(3));

    expect(jobs.update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        status: 'failed',
        error: expect.stringMatching(/Mapbox fora do ar/),
      }),
    );
    expect(metrics.observeQueueJobFailure).toHaveBeenCalledWith('optimization', 'exhausted');
  });

  // Fechar o job exige a transação de tenant: sem `app.current_tenant`, a RLS
  // não enxerga a linha e o `update` silenciosamente não acerta nada.
  it('fecha o job dentro do contexto de tenant', async () => {
    const jobs = {
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as OptimizationJobRepositoryPort;
    const ds = fakeDataSource();
    const worker = new OptimizationJobWorker(
      config,
      ds,
      {} as ProcessOptimizationJobUseCase,
      jobs,
      metricsStub(),
    );

    await chamarOnFailed(worker, jobFalho(3));

    expect(ds.transaction).toHaveBeenCalled();
  });

  it('falha ao fechar o job não derruba o worker', async () => {
    const jobs = {
      update: jest.fn().mockRejectedValue(new Error('banco fora')),
    } as unknown as OptimizationJobRepositoryPort;
    const worker = new OptimizationJobWorker(
      config,
      fakeDataSource(),
      {} as ProcessOptimizationJobUseCase,
      jobs,
      metricsStub(),
    );

    await expect(chamarOnFailed(worker, jobFalho(3))).resolves.toBeUndefined();
  });

  it('sem driver bullmq, o worker se declara desligado', () => {
    const worker = new OptimizationJobWorker(
      { optimizer: { queueDriver: 'inprocess', workerEnabled: true } } as AppConfigService,
      fakeDataSource(),
      {} as ProcessOptimizationJobUseCase,
      {} as OptimizationJobRepositoryPort,
      metricsStub(),
    );

    expect(worker.workerStatus()).toBe('disabled');
  });

  // Habilitado e sem worker construído: é o processo que prometeu consumir e
  // não está consumindo — o estado que tira a instância de rotação.
  it('habilitado mas sem worker ativo se declara parado', () => {
    const worker = new OptimizationJobWorker(
      { optimizer: { queueDriver: 'bullmq', workerEnabled: true } } as AppConfigService,
      fakeDataSource(),
      {} as ProcessOptimizationJobUseCase,
      {} as OptimizationJobRepositoryPort,
      metricsStub(),
    );

    expect(worker.workerStatus()).toBe('stopped');
  });
});
