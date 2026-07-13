import { Injectable } from '@nestjs/common';
import type { RealtimeEvent } from '@navix/contracts';
import { Observable, Subject, filter, map } from 'rxjs';

interface TenantEvent {
  tenantId: string;
  event: RealtimeEvent;
}

/**
 * Hub de eventos em tempo real (pub/sub **in-process**, isolado por tenant).
 * Publicadores (tracking, jobs de otimização) chamam `publish`; o endpoint SSE
 * consome `stream(tenantId)`. Ver ADR-0018.
 *
 * Multi-instância é o próximo passo: trocar o `Subject` por **Redis pub/sub** (a
 * conexão Redis já existe) para propagar eventos entre réplicas, sem alterar os
 * publicadores nem o endpoint. Enquanto isso, o **polling** cobre o gap.
 */
@Injectable()
export class RealtimeHub {
  private readonly subject = new Subject<TenantEvent>();

  publish(tenantId: string, event: RealtimeEvent): void {
    this.subject.next({ tenantId, event });
  }

  /** Fluxo de eventos de um tenant específico. */
  stream(tenantId: string): Observable<RealtimeEvent> {
    return this.subject.asObservable().pipe(
      filter((m) => m.tenantId === tenantId),
      map((m) => m.event),
    );
  }
}
