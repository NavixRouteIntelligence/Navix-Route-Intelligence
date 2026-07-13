import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { RealtimeTicket } from '@navix/contracts';

interface TicketEntry {
  tenantId: string;
  userId: string;
  expiresAt: number;
}

const TTL_SECONDS = 60;

/**
 * Emite e valida **tickets** curtos para autenticar a conexão SSE (o `EventSource`
 * não envia `Authorization`). O ticket é obtido com o access token (endpoint
 * autenticado) e apresentado na query do stream. Reutilizável dentro do TTL para
 * tolerar reconexões; expira em 60s. Ver ADR-0018.
 *
 * Store **in-process** (single-instance). Multi-instância → mover para Redis
 * (mesma evolução do hub).
 */
@Injectable()
export class RealtimeTicketService {
  private readonly tickets = new Map<string, TicketEntry>();

  issue(tenantId: string, userId: string): RealtimeTicket {
    this.sweep();
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(ticket, {
      tenantId,
      userId,
      expiresAt: Date.now() + TTL_SECONDS * 1000,
    });
    return { ticket, expiresIn: TTL_SECONDS };
  }

  /** Valida o ticket (sem consumir) e retorna a sessão, ou `null`. */
  verify(ticket: string | undefined): { tenantId: string; userId: string } | null {
    if (!ticket) return null;
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.tickets.delete(ticket);
      return null;
    }
    return { tenantId: entry.tenantId, userId: entry.userId };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.tickets) {
      if (entry.expiresAt < now) this.tickets.delete(key);
    }
  }
}
