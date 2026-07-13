import type { RealtimeEvent } from '@navix/contracts';

import { RealtimeHub } from './realtime-hub';

const ping: RealtimeEvent = { type: 'ping', data: { at: '2026-07-13T00:00:00Z' } };

describe('RealtimeHub', () => {
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
