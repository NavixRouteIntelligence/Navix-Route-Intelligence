import { RealtimeTicketService } from './realtime-ticket.service';

describe('RealtimeTicketService', () => {
  it('emite um ticket e o valida (sem consumir)', () => {
    const svc = new RealtimeTicketService();
    const { ticket, expiresIn } = svc.issue('t1', 'u1');
    expect(expiresIn).toBeGreaterThan(0);
    // Reutilizável dentro do TTL (tolera reconexões).
    expect(svc.verify(ticket)).toEqual({ tenantId: 't1', userId: 'u1' });
    expect(svc.verify(ticket)).toEqual({ tenantId: 't1', userId: 'u1' });
  });

  it('rejeita ticket inexistente ou ausente', () => {
    const svc = new RealtimeTicketService();
    expect(svc.verify('inexistente')).toBeNull();
    expect(svc.verify(undefined)).toBeNull();
  });

  it('rejeita ticket expirado', () => {
    jest.useFakeTimers();
    try {
      const svc = new RealtimeTicketService();
      const { ticket } = svc.issue('t1', 'u1');
      jest.advanceTimersByTime(61_000);
      expect(svc.verify(ticket)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
