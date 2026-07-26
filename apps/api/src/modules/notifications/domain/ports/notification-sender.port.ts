import type { NotificationChannel } from '../notification-event';

export interface OutboundNotification {
  channel: NotificationChannel;
  /** E-mail ou telefone, conforme o canal. */
  destination: string;
  subject: string;
  body: string;
}

/**
 * Envio de notificação (ADR-0084).
 *
 * O MVP tem apenas o adaptador de log — o suficiente para exercitar todo o fluxo
 * (gatilho → preferências → dedup → render → envio) sem credencial de provedor
 * e sem risco de disparar e-mail para gente real antes da hora. Trocar por
 * Resend/SES/SMTP é implementar esta port; nenhum caso de uso muda.
 *
 * WhatsApp/SMS entram pela **mesma** port, com o `channel` decidindo o destino.
 */
export interface NotificationSenderPort {
  /** Canais que este adaptador realmente entrega. */
  supports(channel: NotificationChannel): boolean;
  send(notification: OutboundNotification): Promise<void>;
}

export const NOTIFICATION_SENDER = Symbol('NOTIFICATION_SENDER');
