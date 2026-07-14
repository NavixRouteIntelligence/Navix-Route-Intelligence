import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

import type { DomainEvent } from './domain-event';

export interface TenantDomainEvent {
  tenantId: string;
  event: DomainEvent;
}

/**
 * Barramento de eventos de domínio **in-process** e isolado por tenant (mesmo
 * padrão do `RealtimeHub`, ADR-0018). Publicadores (ex.: casos de uso do
 * Delivery) chamam `publish`; assinantes (ex.: reotimização automática do
 * Optimizer) consomem `stream()`.
 *
 * Multi-instância é o próximo passo: trocar o `Subject` por **Redis pub/sub**
 * (conexão já existe) para propagar entre réplicas, sem alterar publicadores nem
 * assinantes.
 */
@Injectable()
export class DomainEventBus {
  private readonly subject = new Subject<TenantDomainEvent>();

  publish(tenantId: string, event: DomainEvent): void {
    this.subject.next({ tenantId, event });
  }

  stream(): Observable<TenantDomainEvent> {
    return this.subject.asObservable();
  }
}
