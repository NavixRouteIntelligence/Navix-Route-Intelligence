import type { DeliveryStatus } from '@navix/contracts';

/**
 * Máquina de estados da entrega (ver docs — regras de negócio do Delivery).
 *   pending  → in_route | canceled
 *   in_route → delivered | failed | canceled
 *   failed   → in_route | canceled
 *   delivered, canceled → terminais (sem transições)
 */
const TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  pending: ['in_route', 'canceled'],
  in_route: ['delivered', 'failed', 'canceled'],
  failed: ['in_route', 'canceled'],
  delivered: [],
  canceled: [],
};

export const TERMINAL_STATUSES: readonly DeliveryStatus[] = ['delivered', 'canceled'];

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: DeliveryStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
