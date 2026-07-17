import type { JobEventsPort } from '../domain/ports/job-events.port';
import type {
  OptimizationJobRecord,
  OptimizationJobRepositoryPort,
} from '../domain/ports/optimization-job-repository.port';
import type { OptimizeRouteUseCase } from './optimize-route.use-case';
import { ProcessOptimizationJobUseCase } from './process-optimization-job.use-case';

function baseJob(): OptimizationJobRecord {
  return {
    id: 'j1',
    tenantId: 't1',
    status: 'queued',
    request: { actorId: 'a1', deliveryIds: ['d1', 'd2'] },
    routePlanId: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const events: JobEventsPort = { optimizationJobUpdated: jest.fn() };

describe('ProcessOptimizationJobUseCase', () => {
  it('reivindica (queued→running) → succeeded, gravando o routePlanId', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const claim = jest.fn().mockResolvedValue(true);
    const jobs: OptimizationJobRepositoryPort = {
      findById: jest.fn().mockResolvedValue(baseJob()),
      create: jest.fn(),
      update,
      claim, resetForRetry: jest.fn(),
    };
    const optimize = { execute: jest.fn().mockResolvedValue({ id: 'plan-1' }) } as unknown as OptimizeRouteUseCase;

    const uc = new ProcessOptimizationJobUseCase(jobs, events, optimize);
    const ok = await uc.execute('t1', 'j1');

    expect(ok).toBe(true);
    expect(claim).toHaveBeenCalledWith('j1');
    // O `running` é a própria reivindicação atômica; `update` só grava o desfecho.
    expect(update).toHaveBeenNthCalledWith(1, 'j1', { status: 'succeeded', routePlanId: 'plan-1' });
    expect(optimize.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', deliveryIds: ['d1', 'd2'] }),
    );
  });

  it('falha na otimização → failed com a mensagem de erro', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const jobs: OptimizationJobRepositoryPort = {
      findById: jest.fn().mockResolvedValue(baseJob()),
      create: jest.fn(),
      update,
      claim: jest.fn().mockResolvedValue(true), resetForRetry: jest.fn(),
    };
    const optimize = { execute: jest.fn().mockRejectedValue(new Error('sem paradas')) } as unknown as OptimizeRouteUseCase;

    const uc = new ProcessOptimizationJobUseCase(jobs, events, optimize);
    await uc.execute('t1', 'j1');

    expect(update).toHaveBeenCalledWith('j1', { status: 'failed', error: 'sem paradas' });
  });

  it('perdeu a corrida (claim=false) → não reexecuta (idempotente sob concorrência)', async () => {
    const update = jest.fn();
    const jobs: OptimizationJobRepositoryPort = {
      findById: jest.fn().mockResolvedValue(baseJob()),
      create: jest.fn(),
      update,
      claim: jest.fn().mockResolvedValue(false), resetForRetry: jest.fn(),
    };
    const optimize = { execute: jest.fn() } as unknown as OptimizeRouteUseCase;

    const uc = new ProcessOptimizationJobUseCase(jobs, events, optimize);
    expect(await uc.execute('t1', 'j1')).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(optimize.execute).not.toHaveBeenCalled();
  });

  it('job ainda não visível → retorna false (fila reagenda)', async () => {
    const jobs: OptimizationJobRepositoryPort = {
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      claim: jest.fn(), resetForRetry: jest.fn(),
    };
    const optimize = { execute: jest.fn() } as unknown as OptimizeRouteUseCase;

    const uc = new ProcessOptimizationJobUseCase(jobs, events, optimize);
    expect(await uc.execute('t1', 'j1')).toBe(false);
  });

  it('job já processado (não queued) → não reexecuta', async () => {
    const running = { ...baseJob(), status: 'running' as const };
    const update = jest.fn();
    const jobs: OptimizationJobRepositoryPort = {
      findById: jest.fn().mockResolvedValue(running),
      create: jest.fn(),
      update,
      claim: jest.fn(), resetForRetry: jest.fn(),
    };
    const optimize = { execute: jest.fn() } as unknown as OptimizeRouteUseCase;

    const uc = new ProcessOptimizationJobUseCase(jobs, events, optimize);
    expect(await uc.execute('t1', 'j1')).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(optimize.execute).not.toHaveBeenCalled();
  });
});
