import type { DriverDailySnapshot } from '@navix/contracts';

import type { CachePort } from '../../../shared/cache/cache.port';
import { ValidationError } from '../../../shared/kernel/domain-error';

import { GetKaizenDailyUseCase, MAX_PAST_DAYS } from './get-kaizen-daily.use-case';
import type { GetDriverDailySnapshotUseCase } from './get-driver-daily-snapshot.use-case';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';
const AGORA = new Date('2026-08-09T10:00:00Z');

function foto(over: Partial<DriverDailySnapshot> = {}): DriverDailySnapshot {
  return {
    day: '2026-08-08',
    state: 'ok',
    delivered: 12,
    failed: 1,
    onTime: 11,
    successRate: 12 / 13,
    onTimeRate: 11 / 12,
    activeMinutes: 300,
    savings: null,
    projectedAt: '2026-08-09T02:00:00.000Z',
    timeZone: 'Europe/Lisbon',
    timeZoneSource: 'user',
    settled: true,
    ...over,
  };
}

/** Cache que executa sempre a factory e regista as chaves pedidas. */
function cacheFake() {
  const chaves: string[] = [];
  const cache: CachePort = {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
    getOrSet: async (key, _ttl, factory) => {
      chaves.push(key);
      return factory();
    },
  };
  return { cache, chaves };
}

function build(snapshot: DriverDailySnapshot = foto()) {
  const snapshots = {
    execute: jest.fn().mockResolvedValue(snapshot),
  } as unknown as jest.Mocked<GetDriverDailySnapshotUseCase>;
  const { cache, chaves } = cacheFake();
  return { uc: new GetKaizenDailyUseCase(snapshots, cache), snapshots, chaves };
}

describe('GetKaizenDailyUseCase', () => {
  it('devolve as métricas do dia sem recalcular nada', async () => {
    const { uc } = build();

    const r = await uc.execute(TENANT, LOGIN, '2026-08-08', AGORA);

    expect(r.day).toBe('2026-08-08');
    expect(r.status).toBe('ok');
    expect(r.metrics).toMatchObject({ delivered: 12, failed: 1, onTime: 11, activeMinutes: 300 });
  });

  it('sem baseline, não há deltas nem destaques', async () => {
    const { uc } = build();

    const r = await uc.execute(TENANT, LOGIN, '2026-08-08', AGORA);

    expect(r.baseline).toBeUndefined();
    expect(r.deltas).toBeUndefined();
    expect(r.highlights).toEqual([]);
  });

  describe('intervalo permitido', () => {
    it('aceita ausência de dia — significa ontem', async () => {
      const { uc, snapshots } = build();

      await uc.execute(TENANT, LOGIN, undefined, AGORA);

      expect(snapshots.execute).toHaveBeenCalledWith(TENANT, LOGIN, undefined, AGORA);
    });

    it('recusa formato inválido', async () => {
      const { uc } = build();

      await expect(uc.execute(TENANT, LOGIN, '08/08/2026', AGORA)).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('recusa dia no futuro', async () => {
      const { uc } = build();

      await expect(uc.execute(TENANT, LOGIN, '2026-08-10', AGORA)).rejects.toThrow(/futuro/);
    });

    it('aceita hoje', async () => {
      const { uc } = build();

      await expect(uc.execute(TENANT, LOGIN, '2026-08-09', AGORA)).resolves.toBeDefined();
    });

    it(`recusa para além de ${MAX_PAST_DAYS} dias`, async () => {
      const { uc } = build();
      const antigo = new Date(AGORA.getTime() - (MAX_PAST_DAYS + 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);

      await expect(uc.execute(TENANT, LOGIN, antigo, AGORA)).rejects.toThrow(/intervalo/);
    });

    it('aceita exatamente o limite', async () => {
      const { uc } = build();
      const limite = new Date(AGORA.getTime() - MAX_PAST_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 10);

      await expect(uc.execute(TENANT, LOGIN, limite, AGORA)).resolves.toBeDefined();
    });

    it('o dia inválido é recusado antes de tocar no cache ou no read model', async () => {
      const { uc, snapshots, chaves } = build();

      await expect(uc.execute(TENANT, LOGIN, 'ontem', AGORA)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(snapshots.execute).not.toHaveBeenCalled();
      expect(chaves).toEqual([]);
    });
  });

  describe('cache', () => {
    // Partilhar cache entre pessoas seria a forma mais silenciosa possível de
    // vazar o resumo de alguém para outra.
    it('a chave separa tenant, utilizador e dia', async () => {
      const { uc, chaves } = build();

      await uc.execute(TENANT, LOGIN, '2026-08-08', AGORA);

      expect(chaves[0]).toBe(`kaizen:daily:${TENANT}:${LOGIN}:2026-08-08`);
    });

    it('utilizadores diferentes nunca partilham chave', async () => {
      const { uc, chaves } = build();

      await uc.execute(TENANT, 'user-a', '2026-08-08', AGORA);
      await uc.execute(TENANT, 'user-b', '2026-08-08', AGORA);

      expect(new Set(chaves).size).toBe(2);
    });

    it('tenants diferentes nunca partilham chave', async () => {
      const { uc, chaves } = build();

      await uc.execute('tenant-a', LOGIN, '2026-08-08', AGORA);
      await uc.execute('tenant-b', LOGIN, '2026-08-08', AGORA);

      expect(new Set(chaves).size).toBe(2);
    });
  });

  describe('confiança', () => {
    it('projeção pendente sai declarada na resposta', async () => {
      const { uc } = build(foto({ state: 'pending', activeMinutes: null }));

      const r = await uc.execute(TENANT, LOGIN, '2026-08-08', AGORA);

      expect(r.confidence).toBe('low');
      expect(r.reasons).toContain('projection-pending');
    });

    it('a resposta nunca omite a confiança', async () => {
      const { uc } = build();

      const r = await uc.execute(TENANT, LOGIN, '2026-08-08', AGORA);

      expect(['high', 'medium', 'low']).toContain(r.confidence);
      expect(Array.isArray(r.reasons)).toBe(true);
    });
  });
});
