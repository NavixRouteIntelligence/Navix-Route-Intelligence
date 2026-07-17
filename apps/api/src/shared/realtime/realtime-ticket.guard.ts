import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';

import { UnauthorizedError } from '../kernel/domain-error';
import { RealtimeTicketService, type TicketSession } from './realtime-ticket.service';

/** Request com a sessão resolvida pelo ticket. */
interface TicketRequest {
  query: { ticket?: string };
  realtimeSession?: TicketSession;
}

/**
 * Autoriza a conexão SSE pelo ticket da query (ADR-0018/0053).
 *
 * A verificação vive num guard — e não no handler — porque handlers `@Sse` **não
 * são aguardados** pelo Nest (`router-execution-context`: o retorno de um SSE
 * handler é passado adiante sem `await`). Como o store de tickets passou a ser
 * assíncrono (Redis), verificar dentro do handler exigiria devolver o erro
 * *dentro* do stream — trocando o **401** atual por um 200 com erro no corpo.
 * No guard, o `throw` continua virando 401 antes de o stream abrir.
 */
@Injectable()
export class RealtimeTicketGuard implements CanActivate {
  constructor(private readonly tickets: RealtimeTicketService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TicketRequest>();
    const session = await this.tickets.verify(request.query?.ticket);
    if (!session) throw new UnauthorizedError('Ticket de tempo real inválido ou expirado.');

    request.realtimeSession = session;
    return true;
  }
}

/** Injeta a sessão resolvida pelo `RealtimeTicketGuard` no handler. */
export const RealtimeSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TicketSession => {
    const request = ctx.switchToHttp().getRequest<Required<TicketRequest>>();
    return request.realtimeSession;
  },
);
