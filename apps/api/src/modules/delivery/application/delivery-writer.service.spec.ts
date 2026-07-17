import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { Delivery } from '../domain/delivery';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import type { CreateDeliveryUseCase } from './create-delivery.use-case';
import { DeliveryWriterService, type DeliveryDraft } from './delivery-writer.service';

function makeDelivery(): Delivery {
  return Delivery.create({
    tenantId: 'tenant-1',
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
  });
}

function build(delivery: Delivery | null) {
  const deliveries: DeliveryRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(delivery),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    findChangedSince: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  const createDelivery = { execute: jest.fn() } as unknown as CreateDeliveryUseCase;
  const service = new DeliveryWriterService(createDelivery, deliveries, audit);
  return { service, deliveries, audit, createDelivery };
}

describe('DeliveryWriterService.markOutcome', () => {
  it('leva de pending a delivered passando por in_route e audita', async () => {
    const delivery = makeDelivery();
    const { service, deliveries, audit } = build(delivery);

    await service.markOutcome({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      deliveryId: 'd-1',
      status: 'delivered',
    });

    expect(delivery.status).toBe('delivered');
    expect(deliveries.save).toHaveBeenCalledWith(delivery);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delivery.outcome',
        metadata: { from: 'pending', to: 'delivered' },
      }),
    );
  });

  it('reabre uma entrega failed (failed → in_route → delivered)', async () => {
    const delivery = makeDelivery();
    delivery.changeStatus('in_route');
    delivery.changeStatus('failed');
    const { service } = build(delivery);

    await service.markOutcome({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      deliveryId: 'd-1',
      status: 'delivered',
    });

    expect(delivery.status).toBe('delivered');
  });

  it('é no-op quando já está no status alvo (não salva, não audita)', async () => {
    const delivery = makeDelivery();
    delivery.changeStatus('in_route');
    delivery.changeStatus('delivered');
    const { service, deliveries, audit } = build(delivery);

    await service.markOutcome({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      deliveryId: 'd-1',
      status: 'delivered',
    });

    expect(deliveries.save).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('lança NotFound quando a entrega não existe', async () => {
    const { service } = build(null);

    await expect(
      service.markOutcome({ tenantId: 'tenant-1', actorId: 'user-1', deliveryId: 'x', status: 'failed' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeliveryWriterService.create', () => {
  const draft: DeliveryDraft = {
    tenantId: 'tenant-1',
    actorId: 'user-1',
    street: 'Rua A',
    number: '10',
    complement: null,
    city: 'São Paulo',
    state: 'SP',
    postalCode: '00000-000',
    country: 'BR',
    latitude: -23.5,
    longitude: -46.6,
    priority: 'normal',
    notes: null,
  };

  it('delega ao CreateDeliveryUseCase e retorna o id', async () => {
    const { service, createDelivery } = build(makeDelivery());
    (createDelivery.execute as jest.Mock).mockResolvedValue({ id: 'new-id' });

    const id = await service.create(draft);

    expect(id).toBe('new-id');
  });

  it('deriva uma janela padrão de 8h quando o draft não traz uma', async () => {
    const { service, createDelivery } = build(makeDelivery());
    (createDelivery.execute as jest.Mock).mockResolvedValue({ id: 'x' });

    await service.create(draft);

    const arg = (createDelivery.execute as jest.Mock).mock.calls[0][0];
    const start = new Date(arg.timeWindow.start).getTime();
    const end = new Date(arg.timeWindow.end).getTime();
    expect(end - start).toBe(8 * 3_600_000);
  });

  it('preserva a janela informada no draft', async () => {
    const { service, createDelivery } = build(makeDelivery());
    (createDelivery.execute as jest.Mock).mockResolvedValue({ id: 'x' });
    const timeWindow = { start: '2026-07-06T09:00:00Z', end: '2026-07-06T10:00:00Z' };

    await service.create({ ...draft, timeWindow });

    const arg = (createDelivery.execute as jest.Mock).mock.calls[0][0];
    expect(arg.timeWindow).toEqual(timeWindow);
  });
});
