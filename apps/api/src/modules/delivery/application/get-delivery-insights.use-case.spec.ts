import type { PagedResult } from '../../../shared/kernel/pagination';
import type { Delivery } from '../domain/delivery';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import { GetDeliveryInsightsUseCase } from './get-delivery-insights.use-case';

/** Delivery mínima para o insights: só o que `snapshot()` expõe ao use-case. */
function delivery(status: string, city: string, updatedAt: Date): Delivery {
  return {
    snapshot: () => ({
      status,
      updatedAt,
      address: { snapshot: () => ({ city }) },
    }),
  } as unknown as Delivery;
}

function repo(items: Delivery[]): DeliveryRepositoryPort {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn().mockResolvedValue({ items, total: items.length } as PagedResult<Delivery>),
    findChangedSince: jest.fn(),
    delete: jest.fn(),
  } as unknown as DeliveryRepositoryPort;
}

describe('GetDeliveryInsightsUseCase', () => {
  const from = new Date('2026-07-01T00:00:00.000Z');
  const to = new Date('2026-07-31T23:59:59.999Z');

  it('agrega só as concluídas no intervalo, por região e horário', async () => {
    const items = [
      delivery('delivered', 'Lisboa', new Date('2026-07-10T09:30:00.000Z')),
      delivery('delivered', 'Lisboa', new Date('2026-07-11T09:15:00.000Z')),
      delivery('delivered', 'Porto', new Date('2026-07-12T14:00:00.000Z')),
      delivery('pending', 'Braga', new Date('2026-07-13T10:00:00.000Z')), // ignorada (não concluída)
      delivery('delivered', 'Faro', new Date('2026-06-01T09:00:00.000Z')), // ignorada (fora do intervalo)
    ];
    const uc = new GetDeliveryInsightsUseCase(repo(items));

    const r = await uc.execute('t1', from, to);

    expect(r.totalDelivered).toBe(3);
    expect(r.bestRegion).toBe('Lisboa');
    expect(r.bestHour).toBe(9);
    expect(r.byHour[9].deliveries).toBe(2);
    expect(r.from).toBe('2026-07-01');
  });

  it('sem concluídas: bests null', async () => {
    const uc = new GetDeliveryInsightsUseCase(repo([delivery('pending', 'X', new Date('2026-07-10T09:00:00.000Z'))]));
    const r = await uc.execute('t1', from, to);
    expect(r.totalDelivered).toBe(0);
    expect(r.bestRegion).toBeNull();
    expect(r.bestHour).toBeNull();
  });
});
