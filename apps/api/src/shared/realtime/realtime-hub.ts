import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RealtimeEvent } from '@navix/contracts';
import type { Redis } from 'ioredis';
import { Observable, Subject, filter, map } from 'rxjs';

import { REDIS_CLIENT } from '../redis/redis.constants';

interface TenantEvent {
  tenantId: string;
  event: RealtimeEvent;
}

const CHANNEL = 'navix:realtime';

/**
 * Hub de eventos em tempo real, isolado por tenant (ADR-0018/0040). Publicadores
 * (tracking, jobs de otimização) chamam `publish`; o endpoint SSE consome
 * `stream(tenantId)`.
 *
 * **Escala horizontal (ADR-0040):** quando há Redis, os eventos são propagados
 * por **Redis pub/sub** — cada réplica publica no canal e todas (inclusive ela
 * mesma) recebem e reemitem no `Subject` local, entregando a **todos** os
 * clientes SSE conectados em **qualquer** instância. Sem Redis (ou se ele cair),
 * degrada para o comportamento **in-process** anterior — o `publish` reemite
 * localmente. O consumidor e os publicadores não mudam.
 */
@Injectable()
export class RealtimeHub implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RealtimeHub');
  private readonly subject = new Subject<TenantEvent>();
  private subscriber?: Redis;

  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis) {}

  async onModuleInit(): Promise<void> {
    if (!this.redis) return;
    try {
      // Conexão dedicada: um cliente em modo "subscribe" não executa outros comandos.
      const sub = this.redis.duplicate();
      sub.on('error', () => undefined); // degrada em silêncio; o publish tem fallback
      sub.on('message', (_channel: string, payload: string) => this.onMessage(payload));
      await sub.subscribe(CHANNEL);
      this.subscriber = sub;
      this.logger.log('Propagação de eventos por Redis pub/sub ativa (multi-instância).');
    } catch {
      this.subscriber = undefined; // segue in-process
    }
  }

  publish(tenantId: string, event: RealtimeEvent): void {
    const message: TenantEvent = { tenantId, event };
    if (this.redis && this.subscriber) {
      // Vai ao Redis; retorna via 'message' e é reemitido (uma vez por instância).
      this.redis
        .publish(CHANNEL, JSON.stringify(message))
        .catch(() => this.subject.next(message)); // Redis caiu → fallback local
      return;
    }
    this.subject.next(message);
  }

  /** Fluxo de eventos de um tenant específico. */
  stream(tenantId: string): Observable<RealtimeEvent> {
    return this.subject.asObservable().pipe(
      filter((m) => m.tenantId === tenantId),
      map((m) => m.event),
    );
  }

  private onMessage(payload: string): void {
    try {
      const message = JSON.parse(payload) as TenantEvent;
      if (message?.tenantId && message?.event) this.subject.next(message);
    } catch {
      // payload inválido — ignora
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) return;
    try {
      await this.subscriber.quit();
    } catch {
      this.subscriber.disconnect();
    }
  }
}
