import type { NormalizedSync } from '../../../shared/kernel/sync';
import { decodeCursor } from '../../../shared/kernel/sync';
import { Delivery, type CreateDeliveryInput } from '../domain/delivery';
import type {
  DeliveryChanges,
  DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { SyncDeliveriesUseCase } from './sync-deliveries.use-case';

const baseInput: CreateDeliveryInput = {
  tenantId: 't1',
  address: {
    street: 'Av. Paulista',
    number: '1000',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01310-100',
    country: 'BR',
    latitude: -23.561,
    longitude: -46.656,
  },
  timeWindow: { start: '2026-07-06T09:00:00Z', end: '2026-07-06T12:00:00Z' },
};

function repoReturning(changes: DeliveryChanges): {
  repo: DeliveryRepositoryPort;
  calls: NormalizedSync[];
} {
  const calls: NormalizedSync[] = [];
  const repo = {
    save: async () => undefined,
    findById: async () => null,
    findByIds: async () => [],
    findAll: async () => ({ items: [], total: 0 }),
    findChangedSince: async (_tenantId: string, params: NormalizedSync) => {
      calls.push(params);
      return changes;
    },
  } as unknown as DeliveryRepositoryPort;
  return { repo, calls };
}

describe('SyncDeliveriesUseCase', () => {
  it('mapeia mudanças e emite nextCursor apontando para a última linha', async () => {
    const a = Delivery.create(baseInput);
    const b = Delivery.create(baseInput);
    const { repo } = repoReturning({ items: [a, b], hasMore: true });
    const uc = new SyncDeliveriesUseCase(repo);

    const res = await uc.execute('t1', { limit: 2 });

    expect(res.data).toHaveLength(2);
    expect(res.meta.hasMore).toBe(true);
    expect(res.meta.limit).toBe(2);
    // O cursor deve codificar a (updatedAt, id) da ÚLTIMA entrega devolvida.
    const decoded = decodeCursor(res.meta.nextCursor as string);
    expect(decoded.id).toBe(b.snapshot().id);
  });

  it('sem mais páginas: nextCursor é null', async () => {
    const a = Delivery.create(baseInput);
    const { repo } = repoReturning({ items: [a], hasMore: false });
    const uc = new SyncDeliveriesUseCase(repo);

    const res = await uc.execute('t1', {});
    expect(res.meta.hasMore).toBe(false);
    expect(res.meta.nextCursor).toBeNull();
  });

  it('propaga tombstones (deletedAt preenchido) para o cache offline', async () => {
    const deleted = Delivery.create(baseInput);
    deleted.softDelete();
    const { repo } = repoReturning({ items: [deleted], hasMore: false });
    const uc = new SyncDeliveriesUseCase(repo);

    const res = await uc.execute('t1', {});
    expect(res.data[0].deletedAt).not.toBeNull();
  });

  it('encaminha a marca d’água normalizada ao repositório', async () => {
    const { repo, calls } = repoReturning({ items: [], hasMore: false });
    const uc = new SyncDeliveriesUseCase(repo);

    await uc.execute('t1', { updatedSince: '2026-07-13T10:00:00.000Z' });
    expect(calls[0].since?.toISOString()).toBe('2026-07-13T10:00:00.000Z');
    expect(calls[0].limit).toBe(100);
  });
});
