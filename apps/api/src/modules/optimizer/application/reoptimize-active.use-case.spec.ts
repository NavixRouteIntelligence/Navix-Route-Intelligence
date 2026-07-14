import type { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';
import type { DeliveryGatewayPort, OptimizerDeliveryStop } from './ports/delivery-gateway.port';
import { ReoptimizeActiveUseCase } from './reoptimize-active.use-case';

const stop = (id: string): OptimizerDeliveryStop => ({
  id,
  latitude: 0,
  longitude: 0,
  priority: 'normal',
  timeWindow: null,
});

function build(active: OptimizerDeliveryStop[]) {
  const gateway: DeliveryGatewayPort = {
    getStops: async () => [],
    listActiveStops: async () => active,
  };
  const enqueue = {
    execute: jest.fn().mockResolvedValue({ jobId: 'job-1', status: 'queued' }),
  } as unknown as EnqueueOptimizationUseCase;
  return { uc: new ReoptimizeActiveUseCase(gateway, enqueue), enqueue };
}

describe('ReoptimizeActiveUseCase', () => {
  it('enfileira a reotimização das entregas ativas (>= 2)', async () => {
    const { uc, enqueue } = build([stop('a'), stop('b'), stop('c')]);
    const res = await uc.execute({ tenantId: 't1', actorId: 'system' });

    expect(res).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(enqueue.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      actorId: 'system',
      deliveryIds: ['a', 'b', 'c'],
    });
  });

  it('no-op (null) quando há menos de 2 entregas ativas', async () => {
    const { uc, enqueue } = build([stop('a')]);
    const res = await uc.execute({ tenantId: 't1', actorId: 'system' });
    expect(res).toBeNull();
    expect(enqueue.execute).not.toHaveBeenCalled();
  });
});
