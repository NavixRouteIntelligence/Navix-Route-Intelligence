import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import { CreateDeliveryUseCase } from './create-delivery.use-case';
import type { FleetGatewayPort } from './ports/fleet-gateway.port';

const command = {
  tenantId: 'tenant-1',
  actorId: 'user-1',
  address: {
    street: 'Rua A',
    number: '10',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '00000-000',
    country: 'BR',
    latitude: -23.5,
    longitude: -46.6,
  },
  timeWindow: { start: '2026-07-06T09:00:00Z', end: '2026-07-06T12:00:00Z' },
};

function build(fleet: Partial<FleetGatewayPort> = {}) {
  const repo: DeliveryRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findByIds: jest.fn().mockResolvedValue([]),
    findAll: jest.fn(),
    findChangedSince: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
  };
  const gateway: FleetGatewayPort = {
    vehicleExists: jest.fn().mockResolvedValue(true),
    driverExists: jest.fn().mockResolvedValue(true),
    ...fleet,
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  const events = new DomainEventBus();
  return { repo, gateway, audit, useCase: new CreateDeliveryUseCase(repo, gateway, audit, events) };
}

describe('CreateDeliveryUseCase', () => {
  it('cria a entrega e registra auditoria', async () => {
    const { useCase, repo, audit } = build();
    const result = await useCase.execute(command);

    expect(result.status).toBe('pending');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delivery.created' }),
    );
  });

  it('valida existência do veículo associado via Fleet', async () => {
    const { useCase, repo } = build({ vehicleExists: jest.fn().mockResolvedValue(false) });

    await expect(
      useCase.execute({ ...command, vehicleId: '019f3364-50d8-7665-bcb4-2cc75f065d6c' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
