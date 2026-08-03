import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { Delivery } from '../domain/delivery';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';

import { DeleteDeliveryUseCase } from './delete-delivery.use-case';

function makeDelivery(): Delivery {
  return Delivery.create({
    tenantId: 'tenant-1',
    address: {
      street: 'Rua A',
      number: '10',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01000-000',
      country: 'BR',
      latitude: -23.55,
      longitude: -46.63,
    },
    timeWindow: { start: '2026-08-01T09:00:00Z', end: '2026-08-01T12:00:00Z' },
  });
}

function build(delivery: Delivery | null) {
  const repo: DeliveryRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(delivery),
    findByIds: jest.fn().mockResolvedValue([]),
    findAll: jest.fn(),
    findChangedSince: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
    countActiveByDriver: jest.fn().mockResolvedValue([]),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  const events = new DomainEventBus();

  return { repo, audit, events, useCase: new DeleteDeliveryUseCase(repo, audit, events) };
}

describe('DeleteDeliveryUseCase', () => {
  it('faz soft delete, audita e projeta o dia original da entrega', async () => {
    const delivery = makeDelivery();
    const affectedDay = delivery.snapshot().updatedAt.toISOString().slice(0, 10);
    const { useCase, repo, audit, events } = build(delivery);
    const published: unknown[] = [];
    const subscription = events.stream().subscribe((event) => published.push(event));

    await useCase.execute('tenant-1', delivery.snapshot().id, 'user-1');

    expect(delivery.snapshot().deletedAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledWith(delivery);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delivery.deleted' }),
    );
    expect(published).toEqual([
      {
        tenantId: 'tenant-1',
        event: {
          type: 'delivery.deleted',
          aggregateId: delivery.snapshot().id,
          affectedDay,
        },
      },
    ]);
    subscription.unsubscribe();
  });

  it('retorna 404 quando a entrega não existe', async () => {
    const { useCase } = build(null);

    await expect(useCase.execute('tenant-1', 'missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
