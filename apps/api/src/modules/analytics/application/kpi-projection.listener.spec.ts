import type { DataSource, EntityManager } from 'typeorm';

import { DomainEventBus } from '../../../shared/events/domain-event-bus';

import { KpiProjectionListener } from './kpi-projection.listener';
import type { RebuildKpisUseCase } from './rebuild-kpis.use-case';

function setup(day = jest.fn().mockResolvedValue(undefined)) {
  const manager = { query: jest.fn().mockResolvedValue([]) } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(async (fn: (m: EntityManager) => Promise<unknown>) => fn(manager)),
    // A reconciliação inicial só começa em 10 s; os testes de evento encerram
    // o listener antes disso.
    createQueryRunner: jest.fn(),
  } as unknown as DataSource;
  const bus = new DomainEventBus();
  const rebuild = {
    day,
    backfill: jest.fn().mockResolvedValue(30),
  } as unknown as RebuildKpisUseCase;
  const listener = new KpiProjectionListener(dataSource, bus, rebuild);
  listener.onModuleInit();
  return { bus, day, listener };
}

describe('KpiProjectionListener', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('mantém dias diferentes do mesmo tenant em projeções independentes', async () => {
    const { bus, day, listener } = setup();

    bus.publish('tenant-1', {
      type: 'finance.entry-created',
      aggregateId: 'entry-1',
      affectedDay: '2026-07-10',
    });
    bus.publish('tenant-1', {
      type: 'route.plan-created',
      aggregateId: 'plan-1',
      affectedDay: '2026-07-11',
    });

    await jest.advanceTimersByTimeAsync(3_000);

    expect(day).toHaveBeenCalledTimes(2);
    expect(day).toHaveBeenCalledWith('tenant-1', '2026-07-10');
    expect(day).toHaveBeenCalledWith('tenant-1', '2026-07-11');
    listener.onModuleDestroy();
  });

  it('tenta novamente quando uma projeção falha transitoriamente', async () => {
    const day = jest
      .fn()
      .mockRejectedValueOnce(new Error('indisponível'))
      .mockResolvedValue(undefined);
    const setupResult = setup(day);

    setupResult.bus.publish('tenant-1', {
      type: 'delivery.status-changed',
      aggregateId: 'delivery-1',
      affectedDay: '2026-07-12',
    });

    await jest.advanceTimersByTimeAsync(3_000);
    await jest.advanceTimersByTimeAsync(6_000);

    expect(day).toHaveBeenCalledTimes(2);
    expect(day).toHaveBeenLastCalledWith('tenant-1', '2026-07-12');
    setupResult.listener.onModuleDestroy();
  });
});
