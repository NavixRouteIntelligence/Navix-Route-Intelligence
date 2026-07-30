import { Injectable, Logger } from '@nestjs/common';

import type { NotificationChannel } from '../../domain/notification-event';
import type {
  NotificationSenderPort,
  OutboundNotification,
} from '../../domain/ports/notification-sender.port';

/** Mostra só o começo do endereço: o log não é lugar de PII de terceiros. */
function mask(destination: string): string {
  const [head = '', domain] = destination.split('@');
  const visible = head.slice(0, 2);
  return domain ? `${visible}***@${domain}` : `${visible}***`;
}

/**
 * Adaptador de **log** (ADR-0084): registra o que seria enviado, sem enviar.
 *
 * É o adaptador do MVP por escolha, não por preguiça: exercita o fluxo inteiro
 * — gatilho, opt-out, dedup, i18n, link de rastreio — em dev, em teste e na CI,
 * sem credencial de provedor e **sem risco de disparar e-mail para destinatário
 * real antes de alguém aprovar**.
 *
 * Trocar por Resend/SES/SMTP é implementar a mesma port e mudar o provider no
 * módulo; nenhum caso de uso muda.
 */
@Injectable()
export class LoggingNotificationSender implements NotificationSenderPort {
  private readonly logger = new Logger('NotificationSender');

  supports(channel: NotificationChannel): boolean {
    // Só e-mail no MVP. SMS/WhatsApp precisam de adaptador próprio — devolver
    // `false` faz o caso de uso pular explicitamente, em vez de fingir envio.
    return channel === 'email';
  }

  send(notification: OutboundNotification): Promise<void> {
    this.logger.log(
      `[${notification.channel}] para ${mask(notification.destination)} — "${notification.subject}"`,
    );
    return Promise.resolve();
  }
}
