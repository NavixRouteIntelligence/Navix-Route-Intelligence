import type { OptimizationJobQueuePort } from '../domain/ports/optimization-job-queue.port';
import type { OptimizationJobRepositoryPort } from '../domain/ports/optimization-job-repository.port';
import { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';

describe('EnqueueOptimizationUseCase', () => {
  it('cria um job "queued", enfileira o processamento e retorna o jobId', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn();
    const jobs: OptimizationJobRepositoryPort = { create, findById: jest.fn(), update: jest.fn() };
    const queue: OptimizationJobQueuePort = { enqueue };

    const uc = new EnqueueOptimizationUseCase(jobs, queue);
    const res = await uc.execute({ tenantId: 't1', actorId: 'a1', deliveryIds: ['d1', 'd2'] });

    expect(res.status).toBe('queued');
    expect(res.jobId).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: res.jobId,
        tenantId: 't1',
        status: 'queued',
        request: expect.objectContaining({ actorId: 'a1', deliveryIds: ['d1', 'd2'] }),
      }),
    );
    // O tenantId não vaza para o corpo do request persistido.
    expect(create.mock.calls[0][0].request).not.toHaveProperty('tenantId');
    expect(enqueue).toHaveBeenCalledWith(res.jobId, 't1');
  });
});
