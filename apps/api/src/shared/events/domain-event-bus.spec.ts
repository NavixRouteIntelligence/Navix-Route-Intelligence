import { DomainEventBus } from './domain-event-bus';
import type { TenantDomainEvent } from './domain-event-bus';

describe('DomainEventBus', () => {
  it('entrega eventos publicados aos assinantes, com o tenant', () => {
    const bus = new DomainEventBus();
    const received: TenantDomainEvent[] = [];
    const sub = bus.stream().subscribe((m) => received.push(m));

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    bus.publish('t2', { type: 'delivery.deleted', aggregateId: 'd2' });

    expect(received).toEqual([
      { tenantId: 't1', event: { type: 'delivery.created', aggregateId: 'd1' } },
      { tenantId: 't2', event: { type: 'delivery.deleted', aggregateId: 'd2' } },
    ]);
    sub.unsubscribe();
  });

  it('após unsubscribe não recebe mais eventos', () => {
    const bus = new DomainEventBus();
    const received: TenantDomainEvent[] = [];
    const sub = bus.stream().subscribe((m) => received.push(m));
    sub.unsubscribe();
    bus.publish('t1', { type: 'delivery.updated', aggregateId: 'd1' });
    expect(received).toHaveLength(0);
  });
});
