import type { RealtimeTicket } from '@navix/contracts';

import { apiRequest } from './client';

export const realtimeApi = {
  /** Obtém um ticket curto para autenticar a conexão SSE (ADR-0018). */
  ticket: () => apiRequest<RealtimeTicket>('/realtime/ticket', { method: 'POST' }),
};
