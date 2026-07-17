import type { ExecutionContext } from '@nestjs/common';

import { UnauthorizedError } from '../kernel/domain-error';
import { RealtimeTicketGuard } from './realtime-ticket.guard';
import type { RealtimeTicketService } from './realtime-ticket.service';

interface FakeRequest {
  query: { ticket?: string };
  realtimeSession?: { tenantId: string; userId: string };
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function ticketsResolving(session: { tenantId: string; userId: string } | null) {
  return { verify: jest.fn().mockResolvedValue(session) } as unknown as RealtimeTicketService;
}

describe('RealtimeTicketGuard', () => {
  it('libera a conexão e anexa a sessão ao request', async () => {
    const request: FakeRequest = { query: { ticket: 'valido' } };
    const guard = new RealtimeTicketGuard(ticketsResolving({ tenantId: 't1', userId: 'u1' }));

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.realtimeSession).toEqual({ tenantId: 't1', userId: 'u1' });
  });

  it('rejeita ticket inválido com 401 (e não abre o stream)', async () => {
    const guard = new RealtimeTicketGuard(ticketsResolving(null));

    // O guard existe justamente para preservar o 401 HTTP: handlers @Sse não são
    // aguardados pelo Nest, então verificar no handler devolveria 200 com erro
    // dentro do stream (ADR-0053).
    await expect(guard.canActivate(contextFor({ query: { ticket: 'ruim' } }))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejeita quando não há ticket na query', async () => {
    const tickets = ticketsResolving(null);
    const guard = new RealtimeTicketGuard(tickets);

    await expect(guard.canActivate(contextFor({ query: {} }))).rejects.toThrow(UnauthorizedError);
    expect(tickets.verify).toHaveBeenCalledWith(undefined);
  });
});
