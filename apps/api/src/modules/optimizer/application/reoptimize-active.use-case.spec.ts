import type { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';
import { ForbiddenError } from '../../../shared/kernel/domain-error';
import type { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import type { DeliveryGatewayPort, OptimizerDeliveryStop } from './ports/delivery-gateway.port';
import { ReoptimizeActiveUseCase } from './reoptimize-active.use-case';

const stop = (id: string): OptimizerDeliveryStop => ({
  id,
  latitude: 0,
  longitude: 0,
  priority: 'normal',
  timeWindow: null,
});

function build(active: OptimizerDeliveryStop[], allowed = true) {
  const gateway: DeliveryGatewayPort = {
    getStops: async () => [],
    listActiveStops: jest.fn().mockResolvedValue(active),
  };
  const enqueue = {
    execute: jest.fn().mockResolvedValue({ jobId: 'job-1', status: 'queued' }),
  } as unknown as EnqueueOptimizationUseCase;
  const features = {
    isEnabled: jest.fn().mockResolvedValue(allowed),
    require: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenError();
    }),
  } as unknown as FeatureAccessService;
  return { uc: new ReoptimizeActiveUseCase(gateway, enqueue, features), enqueue, gateway };
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

  it('plano básico é recusado antes de consultar entregas ou enfileirar', async () => {
    const { uc, enqueue, gateway } = build([stop('a'), stop('b')], false);

    await expect(uc.execute({ tenantId: 't-free', actorId: 'u1' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(gateway.listActiveStops).not.toHaveBeenCalled();
    expect(enqueue.execute).not.toHaveBeenCalled();
  });
});
