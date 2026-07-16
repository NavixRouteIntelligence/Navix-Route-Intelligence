import type { RealtimeEvent } from '@navix/contracts';
import type { Redis } from 'ioredis';

import { RealtimeHub } from './realtime-hub';

const ping: RealtimeEvent = { type: 'ping', data: { at: '2026-07-13T00:00:00Z' } };

/** Fake mínimo de ioredis: o `publish` faz *loopback* no handler de 'message'. */
class FakeRedis {
  private handler?: (channel: string, payload: string) => void;
  publishFails = false;

  duplicate(): this {
    return this;
  }
  on(event: string, cb: (channel: string, payload: string) => void): this {
    if (event === 'message') this.handler = cb;
    return this;
  }
  subscribe(): Promise<number> {
    return Promise.resolve(1);
  }
  publish(channel: string, payload: string): Promise<number> {
    if (this.publishFails) return Promise.reject(new Error('redis down'));
    this.handler?.(channel, payload);
    return Promise.resolve(1);
  }
  quit(): Promise<'OK'> {
    return Promise.resolve('OK');
  }
  disconnect(): void {
    /* noop */
  }
}

describe('RealtimeHub (in-process)', () => {
  it('entrega eventos apenas ao tenant inscrito (isolamento)', () => {
    const hub = new RealtimeHub();
    const t1: RealtimeEvent[] = [];
    const sub = hub.stream('t1').subscribe((e) => t1.push(e));

    hub.publish('t1', ping);
    hub.publish('t2', ping); // outro tenant — não deve chegar em t1

    sub.unsubscribe();
    expect(t1).toEqual([ping]);
  });

  it('é um stream quente: não entrega eventos anteriores à inscrição', () => {
    const hub = new RealtimeHub();
    hub.publish('t1', ping);

    const received: RealtimeEvent[] = [];
    const sub = hub.stream('t1').subscribe((e) => received.push(e));
    sub.unsubscribe();

    expect(received).toHaveLength(0);
  });
});

describe('RealtimeHub (Redis pub/sub — ADR-0040)', () => {
  it('propaga via Redis e entrega exatamente uma vez (sem duplicar)', async () => {
    const redis = new FakeRedis();
    const hub = new RealtimeHub(redis as unknown as Redis);
    await hub.onModuleInit();

    const got: RealtimeEvent[] = [];
    const sub = hub.stream('t1').subscribe((e) => got.push(e));
    hub.publish('t1', ping);
    sub.unsubscribe();

    expect(got).toEqual([ping]);
    await hub.onModuleDestroy();
  });

  it('cai para entrega local quando o publish ao Redis falha', async () => {
    const redis = new FakeRedis();
    redis.publishFails = true;
    const hub = new RealtimeHub(redis as unknown as Redis);
    await hub.onModuleInit();

    const got: RealtimeEvent[] = [];
    const sub = hub.stream('t1').subscribe((e) => got.push(e));
    hub.publish('t1', ping);
    await Promise.resolve(); // deixa o .catch reemitir no Subject
    sub.unsubscribe();

    expect(got).toEqual([ping]);
  });
});
