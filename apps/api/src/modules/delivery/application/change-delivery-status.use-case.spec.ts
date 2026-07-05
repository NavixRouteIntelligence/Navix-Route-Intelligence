import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import { Delivery } from '../domain/delivery';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import { ChangeDeliveryStatusUseCase } from './change-delivery-status.use-case';

function makeDelivery() {
  return Delivery.create({
    tenantId: 'tenant-1',
    address: {
      street: 'Rua A',
      number: '10',
      city: 'SP',
      state: 'SP',
      postalCode: '0',
      country: 'BR',
      latitude: 0,
      longitude: 0,
    },
    timeWindow: { start: '2026-07-06T09:00:00Z', end: '2026-07-06T12:00:00Z' },
  });
}

function build(delivery: Delivery | null) {
  const repo: DeliveryRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(delivery),
    findByIds: jest.fn().mockResolvedValue([]),
    findAll: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  return { repo, audit, useCase: new ChangeDeliveryStatusUseCase(repo, audit) };
}

describe('ChangeDeliveryStatusUseCase', () => {
  const cmd = { tenantId: 'tenant-1', id: 'x', actorId: 'user-1' as string };

  it('aplica transição válida e audita', async () => {
    const { useCase, repo, audit } = build(makeDelivery());
    const result = await useCase.execute({ ...cmd, status: 'in_route' });

    expect(result.status).toBe('in_route');
    expect(repo.save).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delivery.status_changed' }),
    );
  });

  it('rejeita transição inválida (409)', async () => {
    const { useCase } = build(makeDelivery());
    await expect(useCase.execute({ ...cmd, status: 'delivered' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('404 quando a entrega não existe', async () => {
    const { useCase } = build(null);
    await expect(useCase.execute({ ...cmd, status: 'in_route' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
