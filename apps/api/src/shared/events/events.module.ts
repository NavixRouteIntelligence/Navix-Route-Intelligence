import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus';

/** Barramento de eventos de domínio (in-process), global (ADR-0023). */
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
