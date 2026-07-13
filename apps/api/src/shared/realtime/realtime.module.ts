import { Global, Module } from '@nestjs/common';

import { RealtimeController } from './realtime.controller';
import { RealtimeHub } from './realtime-hub';
import { RealtimeTicketService } from './realtime-ticket.service';

/**
 * Transporte em tempo real (SSE — ADR-0018). Global: expõe o `RealtimeHub` para
 * que qualquer módulo publique eventos (tracking, jobs de otimização).
 */
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeHub, RealtimeTicketService],
  exports: [RealtimeHub],
})
export class RealtimeModule {}
