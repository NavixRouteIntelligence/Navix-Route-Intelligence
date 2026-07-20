import { Delivery, type CreateDeliveryInput } from '../domain/delivery';
import type { DeliveryStatus } from '@navix/contracts';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import { DeliveryLookupService } from './delivery-lookup.service';

function makeDelivery(overrides: Partial<CreateDeliveryInput> = {}, status?: DeliveryStatus): Delivery {
  const d = Delivery.create({
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
    ...overrides,
  });
  // Caminha a máquina de estados até o status pedido.
  if (status === 'in_route' || status === 'delivered' || status === 'failed') d.changeStatus('in_route');
  if (status === 'delivered' || status === 'failed') d.changeStatus(status);
  return d;
}

function build(items: Delivery[], byIds: Delivery[] = []) {
  const deliveries: DeliveryRepositoryPort = {
    save: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn().mockResolvedValue(byIds),
    findAll: jest.fn().mockResolvedValue({ items, total: items.length }),
    findChangedSince: jest.fn(),
  };
  return { service: new DeliveryLookupService(deliveries), deliveries };
}

describe('DeliveryLookupService.getStops', () => {
  it('mapeia as entregas encontradas para DeliveryStopDto', async () => {
    const d = makeDelivery();
    const { service } = build([], [d]);

    const stops = await service.getStops('tenant-1', [d.snapshot().id]);

    expect(stops).toHaveLength(1);
    expect(stops[0]).toEqual({
      id: d.snapshot().id,
      latitude: -23.5,
      longitude: -46.6,
      priority: 'normal',
      timeWindow: { start: '2026-07-06T09:00:00.000Z', end: '2026-07-06T12:00:00.000Z' },
      addressText: 'Rua A São Paulo',
    });
  });
});

describe('DeliveryLookupService.listActive', () => {
  it('retorna apenas entregas ativas (pending / in_route)', async () => {
    const pending = makeDelivery();
    const inRoute = makeDelivery({}, 'in_route');
    const delivered = makeDelivery({}, 'delivered');
    const failed = makeDelivery({}, 'failed');
    const { service } = build([pending, inRoute, delivered, failed]);

    const stops = await service.listActive('tenant-1');

    const ids = stops.map((s) => s.id).sort();
    expect(ids).toEqual([pending.snapshot().id, inRoute.snapshot().id].sort());
  });

  it('lista vazia quando não há entregas ativas', async () => {
    const { service } = build([makeDelivery({}, 'delivered')]);

    await expect(service.listActive('tenant-1')).resolves.toEqual([]);
  });
});
