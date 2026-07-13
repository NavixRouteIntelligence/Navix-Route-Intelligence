import {
  Controller,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, RealtimeEvent, RealtimeTicket } from '@navix/contracts';
import { interval, map, merge, Observable } from 'rxjs';

import { CurrentUser } from '../interface/current-user.decorator';
import { UnauthorizedError } from '../kernel/domain-error';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { RealtimeHub } from './realtime-hub';
import { RealtimeTicketService } from './realtime-ticket.service';

const HEARTBEAT_MS = 25_000;

/**
 * Transporte em tempo real por **SSE** (ADR-0018). Fluxo:
 *  1. `POST /realtime/ticket` (autenticado) → obtém um ticket curto.
 *  2. `GET /realtime/stream?ticket=…` (EventSource) → stream de eventos do tenant.
 *
 * O stream não usa `JwtAuthGuard` (o EventSource não envia `Authorization`);
 * a autorização vem do ticket. Um `ping` periódico mantém a conexão viva.
 */
@ApiTags('realtime')
@Controller({ path: 'realtime', version: '1' })
export class RealtimeController {
  constructor(
    private readonly hub: RealtimeHub,
    private readonly tickets: RealtimeTicketService,
  ) {}

  @Post('ticket')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emite um ticket curto para autenticar a conexão SSE' })
  ticket(@CurrentUser() user: AuthenticatedUser): RealtimeTicket {
    return this.tickets.issue(user.tenantId, user.id);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Stream SSE de eventos do tenant (autenticado por ticket)' })
  stream(@Query('ticket') ticket?: string): Observable<MessageEvent> {
    const session = this.tickets.verify(ticket);
    if (!session) throw new UnauthorizedError('Ticket de tempo real inválido ou expirado.');

    const events = this.hub
      .stream(session.tenantId)
      .pipe(map((event) => ({ data: event }) as MessageEvent));

    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(
        () =>
          ({ data: { type: 'ping', data: { at: new Date().toISOString() } } as RealtimeEvent }) as MessageEvent,
      ),
    );

    return merge(events, heartbeat);
  }
}
