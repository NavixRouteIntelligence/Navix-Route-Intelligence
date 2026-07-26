import {
  DEFAULT_LOCALE,
  type NotificationEvent,
  type NotificationLocale,
} from './notification-event';

export interface RenderedNotification {
  subject: string;
  body: string;
}

export interface TemplateData {
  /** Nome de quem recebe; ausente quando a origem não informou. */
  recipient: string | null;
  /** Link de rastreio — presente em toda notificação (growth loop). */
  trackingUrl: string;
  /** Endereço para parar de receber. */
  optOutUrl: string;
}

type Copy = Record<NotificationEvent, { subject: string; lead: string }>;

/**
 * Texto das notificações nos quatro idiomas do produto.
 *
 * Deliberadamente **sem dado sensível**: nem endereço, nem observações, nem
 * nome do motorista. Quem tem o link já sabe o próprio endereço, e um e-mail
 * encaminhado não pode virar vazamento (mesma regra do ADR-0082).
 *
 * Texto puro, não HTML: o MVP envia pelo adaptador de log e o corpo precisa ser
 * legível em qualquer canal — inclusive SMS/WhatsApp, quando entrarem pela
 * mesma port.
 */
const COPY: Record<NotificationLocale, Copy> = {
  'pt-BR': {
    dispatched: {
      subject: 'Sua entrega saiu para entrega',
      lead: 'Sua entrega saiu e está a caminho.',
    },
    nearby: {
      subject: 'Sua entrega está chegando',
      lead: 'O veículo está perto do endereço de entrega.',
    },
    delivered: { subject: 'Sua entrega foi concluída', lead: 'Entrega concluída. Obrigado!' },
    delayed: {
      subject: 'Sua entrega está atrasada',
      lead: 'A rota atrasou e a chegada deve demorar mais do que o previsto.',
    },
  },
  'pt-PT': {
    dispatched: {
      subject: 'A sua entrega saiu para entrega',
      lead: 'A sua entrega saiu e está a caminho.',
    },
    nearby: {
      subject: 'A sua entrega está a chegar',
      lead: 'O veículo está perto da morada de entrega.',
    },
    delivered: { subject: 'A sua entrega foi concluída', lead: 'Entrega concluída. Obrigado!' },
    delayed: {
      subject: 'A sua entrega está atrasada',
      lead: 'A rota atrasou e a chegada deverá demorar mais do que o previsto.',
    },
  },
  en: {
    dispatched: { subject: 'Your delivery is on its way', lead: 'Your delivery has left and is on its way.' },
    nearby: { subject: 'Your delivery is arriving', lead: 'The vehicle is close to the delivery address.' },
    delivered: { subject: 'Your delivery is complete', lead: 'Delivery completed. Thank you!' },
    delayed: {
      subject: 'Your delivery is delayed',
      lead: 'The route is running late and arrival may take longer than expected.',
    },
  },
  es: {
    dispatched: { subject: 'Tu entrega salió para entrega', lead: 'Tu entrega salió y está en camino.' },
    nearby: { subject: 'Tu entrega está llegando', lead: 'El vehículo está cerca de la dirección de entrega.' },
    delivered: { subject: 'Tu entrega se completó', lead: '¡Entrega completada. Gracias!' },
    delayed: {
      subject: 'Tu entrega está retrasada',
      lead: 'La ruta se retrasó y la llegada puede tardar más de lo previsto.',
    },
  },
};

const FOOTER: Record<NotificationLocale, { track: string; optOut: string }> = {
  'pt-BR': { track: 'Acompanhe em tempo real:', optOut: 'Não quer mais receber estes avisos?' },
  'pt-PT': { track: 'Acompanhe em tempo real:', optOut: 'Não quer voltar a receber estes avisos?' },
  en: { track: 'Track it live:', optOut: 'Prefer not to receive these updates?' },
  es: { track: 'Sigue en tiempo real:', optOut: '¿Prefieres no recibir estos avisos?' },
};

const GREETING: Record<NotificationLocale, (name: string) => string> = {
  'pt-BR': (n) => `Olá, ${n}!`,
  'pt-PT': (n) => `Olá, ${n}!`,
  en: (n) => `Hi ${n},`,
  es: (n) => `¡Hola, ${n}!`,
};

/** Idioma desconhecido cai no padrão em vez de quebrar o envio. */
export function resolveLocale(raw: string | null | undefined): NotificationLocale {
  if (raw && raw in COPY) return raw as NotificationLocale;
  return DEFAULT_LOCALE;
}

export function renderNotification(
  event: NotificationEvent,
  locale: NotificationLocale,
  data: TemplateData,
): RenderedNotification {
  const copy = COPY[locale][event];
  const footer = FOOTER[locale];

  const lines: string[] = [];
  if (data.recipient) lines.push(GREETING[locale](data.recipient), '');
  lines.push(copy.lead, '', `${footer.track} ${data.trackingUrl}`, '', `${footer.optOut} ${data.optOutUrl}`);

  return { subject: copy.subject, body: lines.join('\n') };
}
