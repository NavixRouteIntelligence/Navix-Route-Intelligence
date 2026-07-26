/**
 * Notificações ao destinatário (ADR-0084) — o lado B2B2C do rastreamento
 * público (ADR-0082).
 *
 * Cada evento sai **uma única vez por entrega** (unicidade em `notification_log`)
 * e sempre carrega o link de rastreio: é o que fecha o *growth loop* — quem
 * recebe uma entrega conhece a Navix pelo acompanhamento, não por anúncio.
 */
export type NotificationEvent =
  /** Saiu para entrega — a entrega entrou em rota. */
  | 'dispatched'
  /** O veículo está perto do destino. */
  | 'nearby'
  /** Entregue. */
  | 'delivered'
  /** A rota atrasou além do limiar. */
  | 'delayed';

export const NOTIFICATION_EVENTS: readonly NotificationEvent[] = [
  'dispatched',
  'nearby',
  'delivered',
  'delayed',
];

/**
 * Canais. Só `email` envia no MVP; os demais existem como destino da mesma
 * port, para que ligar WhatsApp/SMS depois não mexa em caso de uso nenhum.
 */
export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

/** Idiomas suportados — os mesmos do produto (web/mobile). */
export type NotificationLocale = 'pt-BR' | 'pt-PT' | 'en' | 'es';

export const DEFAULT_LOCALE: NotificationLocale = 'pt-BR';

export interface NotificationRecipient {
  email: string | null;
  phone: string | null;
}
