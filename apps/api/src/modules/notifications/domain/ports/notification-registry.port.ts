import type { NotificationChannel, NotificationEvent } from '../notification-event';

/**
 * Memória das notificações: o que já saiu (para não repetir) e quem pediu para
 * não receber mais (ADR-0084).
 */
export interface NotificationRegistryPort {
  /**
   * Marca o envio e devolve `true` se **esta** chamada ganhou o direito de
   * enviar. Um segundo disparo do mesmo evento para a mesma entrega devolve
   * `false` — a unicidade vive no banco, então continua valendo mesmo com dois
   * processos concorrendo (a API e o worker, por exemplo).
   */
  claim(input: {
    tenantId: string;
    deliveryId: string;
    event: NotificationEvent;
    channel: NotificationChannel;
    destination: string;
  }): Promise<boolean>;

  /** O destinatário pediu para não receber mais neste canal? */
  isOptedOut(tenantId: string, channel: NotificationChannel, destination: string): Promise<boolean>;

  /** Registra o opt-out. Idempotente. */
  optOut(tenantId: string, channel: NotificationChannel, destination: string): Promise<void>;
}

export const NOTIFICATION_REGISTRY = Symbol('NOTIFICATION_REGISTRY');
