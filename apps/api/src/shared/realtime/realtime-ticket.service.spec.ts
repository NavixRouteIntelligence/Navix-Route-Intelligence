import type { Redis } from 'ioredis';

import { RealtimeTicketService } from './realtime-ticket.service';

/**
 * Redis falso com store injetável: compartilhar o `Map` entre duas instâncias do
 * serviço é o que permite reproduzir o cenário multi-instância do ADR-0053.
 */
function fakeRedis(store = new Map<string, string>()): Redis & { store: Map<string, string> } {
  return {
    status: 'ready',
    store,
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
  } as unknown as Redis & { store: Map<string, string> };
}

describe('RealtimeTicketService', () => {
  describe('sem Redis (dev single-instance)', () => {
    it('emite um ticket e o valida (sem consumir)', async () => {
      const svc = new RealtimeTicketService();
      const { ticket, expiresIn } = await svc.issue('t1', 'u1');

      expect(expiresIn).toBeGreaterThan(0);
      // Reutilizável dentro do TTL (tolera reconexões).
      await expect(svc.verify(ticket)).resolves.toEqual({ tenantId: 't1', userId: 'u1' });
      await expect(svc.verify(ticket)).resolves.toEqual({ tenantId: 't1', userId: 'u1' });
    });

    it('rejeita ticket inexistente ou ausente', async () => {
      const svc = new RealtimeTicketService();

      await expect(svc.verify('inexistente')).resolves.toBeNull();
      await expect(svc.verify(undefined)).resolves.toBeNull();
    });

    it('rejeita ticket expirado', async () => {
      jest.useFakeTimers();
      try {
        const svc = new RealtimeTicketService();
        const { ticket } = await svc.issue('t1', 'u1');

        jest.advanceTimersByTime(61_000);

        await expect(svc.verify(ticket)).resolves.toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('com Redis (multi-instância — ADR-0053)', () => {
    it('valida numa instância um ticket emitido por OUTRA', async () => {
      // O defeito que a auditoria 5 encontrou (R1): com store in-process, o
      // ticket emitido por A era desconhecido em B e a conexão SSE falhava com
      // probabilidade (N-1)/N atrás do load balancer.
      const shared = new Map<string, string>();
      const instanceA = new RealtimeTicketService(fakeRedis(shared));
      const instanceB = new RealtimeTicketService(fakeRedis(shared));

      const { ticket } = await instanceA.issue('t1', 'u1');

      await expect(instanceB.verify(ticket)).resolves.toEqual({ tenantId: 't1', userId: 'u1' });
    });

    it('grava no Redis com TTL nativo', async () => {
      const redis = fakeRedis();
      const svc = new RealtimeTicketService(redis);

      const { ticket } = await svc.issue('t1', 'u1');

      expect(redis.set).toHaveBeenCalledWith(
        `navix:rt:ticket:${ticket}`,
        JSON.stringify({ tenantId: 't1', userId: 'u1' }),
        'EX',
        60,
      );
    });

    it('rejeita ticket ausente do Redis sem consultar a memória local', async () => {
      const svc = new RealtimeTicketService(fakeRedis());

      await expect(svc.verify('forjado')).resolves.toBeNull();
    });

    it('ignora o Redis enquanto ele não está pronto (usa o fallback)', async () => {
      const redis = { status: 'connecting', set: jest.fn(), get: jest.fn() } as unknown as Redis;
      const svc = new RealtimeTicketService(redis);

      const { ticket } = await svc.issue('t1', 'u1');

      expect(redis.set).not.toHaveBeenCalled();
      await expect(svc.verify(ticket)).resolves.toEqual({ tenantId: 't1', userId: 'u1' });
    });

    it('cai para memória quando o comando Redis falha', async () => {
      const redis = {
        status: 'ready',
        set: jest.fn().mockRejectedValue(new Error('connection lost')),
        get: jest.fn().mockRejectedValue(new Error('connection lost')),
      } as unknown as Redis;
      const svc = new RealtimeTicketService(redis);

      // Degrada para o comportamento in-process anterior em vez de negar acesso.
      const { ticket } = await svc.issue('t1', 'u1');

      await expect(svc.verify(ticket)).resolves.toEqual({ tenantId: 't1', userId: 'u1' });
    });
  });
});
