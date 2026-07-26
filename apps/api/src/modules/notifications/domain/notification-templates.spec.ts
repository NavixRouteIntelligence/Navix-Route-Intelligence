import { NOTIFICATION_EVENTS, type NotificationLocale } from './notification-event';
import { renderNotification, resolveLocale } from './notification-templates';

const LOCALES: NotificationLocale[] = ['pt-BR', 'pt-PT', 'en', 'es'];

const DATA = {
  recipient: 'Ana',
  trackingUrl: 'https://track.navix.pt/abc',
  optOutUrl: 'https://track.navix.pt/abc?optout=1',
};

describe('renderNotification', () => {
  // i18n: os quatro eventos nos quatro idiomas do produto. Um texto faltando
  // viraria assunto vazio no e-mail do destinatário.
  it.each(LOCALES)('tem texto completo em %s', (locale) => {
    for (const event of NOTIFICATION_EVENTS) {
      const { subject, body } = renderNotification(event, locale, DATA);
      expect(subject.trim().length).toBeGreaterThan(0);
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });

  // O link é o growth loop: sem ele a notificação não cumpre o papel.
  it.each(LOCALES)('inclui rastreio e opt-out em %s', (locale) => {
    for (const event of NOTIFICATION_EVENTS) {
      const { body } = renderNotification(event, locale, DATA);
      expect(body).toContain(DATA.trackingUrl);
      expect(body).toContain(DATA.optOutUrl);
    }
  });

  it('cada idioma tem assunto próprio (não sobrou tradução faltando)', () => {
    for (const event of NOTIFICATION_EVENTS) {
      const subjects = LOCALES.map((l) => renderNotification(event, l, DATA).subject);
      // en e es são sempre distintos do pt; pt-BR/pt-PT podem coincidir.
      expect(new Set(subjects).size).toBeGreaterThanOrEqual(3);
    }
  });

  it('sem nome do destinatário, não inventa saudação', () => {
    const { body } = renderNotification('dispatched', 'pt-BR', { ...DATA, recipient: null });
    expect(body).not.toContain('Olá');
    expect(body).toContain(DATA.trackingUrl);
  });

  // Regra de PII do ADR-0082/0084: quem tem o link já sabe o próprio endereço.
  it('não vaza endereço, motorista nem observações', () => {
    const { subject, body } = renderNotification('nearby', 'pt-BR', DATA);
    for (const proibido of ['Rua', 'motorista', 'observa']) {
      expect(`${subject} ${body}`.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });
});

describe('resolveLocale', () => {
  it('aceita os idiomas do produto', () => {
    for (const l of LOCALES) expect(resolveLocale(l)).toBe(l);
  });

  // O destinatário não tem conta: idioma desconhecido não pode quebrar o envio.
  it.each([null, undefined, '', 'fr', 'xx-YY'])('%p cai no padrão', (raw) => {
    expect(resolveLocale(raw)).toBe('pt-BR');
  });
});
