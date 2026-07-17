import { randomBytes } from 'node:crypto';

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RealtimeTicket } from '@navix/contracts';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.constants';

interface TicketEntry {
  tenantId: string;
  userId: string;
  expiresAt: number;
}

const TTL_SECONDS = 60;
const PREFIX = 'navix:rt:ticket:';

/** Sessão autorizada a abrir o stream. */
export interface TicketSession {
  tenantId: string;
  userId: string;
}

/**
 * Emite e valida **tickets** curtos para autenticar a conexão SSE (o `EventSource`
 * não envia `Authorization`). O ticket é obtido com o access token (endpoint
 * autenticado) e apresentado na query do stream. Reutilizável dentro do TTL para
 * tolerar reconexões; expira em 60s. Ver ADR-0018.
 *
 * **Escala horizontal (ADR-0053):** o store é **Redis**, com TTL nativo. Antes o
 * ticket vivia num `Map` do processo: emitido pela instância A, a conexão SSE
 * caía numa instância aleatória atrás do load balancer e falhava com
 * probabilidade **(N−1)/N** — com 3 réplicas, 67% das conexões de rastreamento.
 * O hub já havia migrado para Redis (ADR-0040); o ticket ficara para trás.
 *
 * Sem Redis (ou se ele cair), degrada para o `Map` in-process anterior — mesma
 * estratégia do `RealtimeHub` e do `ThrottlerStorageRedis`. Em dev
 * single-instance o comportamento é idêntico ao de antes.
 */
@Injectable()
export class RealtimeTicketService {
  private readonly logger = new Logger('RealtimeTicketService');
  private readonly local = new Map<string, TicketEntry>();
  private fellBack = false;

  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis) {}

  async issue(tenantId: string, userId: string): Promise<RealtimeTicket> {
    const ticket = randomBytes(32).toString('base64url');
    const session: TicketSession = { tenantId, userId };
    const redis = this.usableRedis();

    if (redis) {
      try {
        // TTL nativo do Redis: sem varredura e sem ticket órfão.
        await redis.set(PREFIX + ticket, JSON.stringify(session), 'EX', TTL_SECONDS);
        return { ticket, expiresIn: TTL_SECONDS };
      } catch (err) {
        this.warnFallback(err);
      }
    }

    this.sweep();
    this.local.set(ticket, { ...session, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    return { ticket, expiresIn: TTL_SECONDS };
  }

  /** Valida o ticket (sem consumir) e retorna a sessão, ou `null`. */
  async verify(ticket: string | undefined): Promise<TicketSession | null> {
    if (!ticket) return null;
    const redis = this.usableRedis();

    if (redis) {
      try {
        const raw = await redis.get(PREFIX + ticket);
        // Ausente no Redis = inválido, ponto. Não se cai para o mapa local aqui:
        // o ticket pode ter sido emitido por outra instância, e consultar a
        // memória local só produziria um "válido" acidental do próprio processo.
        return raw ? (JSON.parse(raw) as TicketSession) : null;
      } catch (err) {
        this.warnFallback(err);
      }
    }

    const entry = this.local.get(ticket);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.local.delete(ticket);
      return null;
    }
    return { tenantId: entry.tenantId, userId: entry.userId };
  }

  /** O cliente Redis, se existir e estiver pronto para comandos. */
  private usableRedis(): Redis | undefined {
    return this.redis?.status === 'ready' ? this.redis : undefined;
  }

  private warnFallback(err: unknown): void {
    if (this.fellBack) return;
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Falha no Redis (${message}). Tickets de realtime em memória (fallback).`);
    this.fellBack = true;
  }

  /** Expurgo do store local (no Redis o TTL nativo cuida disso). */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.local) {
      if (entry.expiresAt < now) this.local.delete(key);
    }
  }
}
