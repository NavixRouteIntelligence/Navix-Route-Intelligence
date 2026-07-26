import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { NotificationRegistryPort } from '../domain/ports/notification-registry.port';
import type { NotificationSenderPort } from '../domain/ports/notification-sender.port';
import { NotifyRecipientUseCase } from './notify-recipient.use-case';
import type {
  DeliveryContactGatewayPort,
  NotifiableDelivery,
  TrackingLinkGatewayPort,
} from './ports/notification-sources.port';

const DELIVERY: NotifiableDelivery = {
  id: 'del-1',
  recipient: 'Ana',
  recipientEmail: 'ana@exemplo.test',
  recipientPhone: '+351900000000',
  latitude: 38.72,
  longitude: -9.14,
  driverId: 'driver-1',
  status: 'in_route',
};

function build(opts: {
  enabled?: boolean;
  channel?: 'email' | 'sms';
  delivery?: NotifiableDelivery | null;
  optedOut?: boolean;
  claimed?: boolean;
  sendFails?: boolean;
} = {}) {
  const config = {
    notifications: {
      enabled: opts.enabled ?? true,
      channel: opts.channel ?? 'email',
      locale: 'pt-BR',
    },
  } as AppConfigService;

  const deliveries = {
    find: jest.fn().mockResolvedValue('delivery' in opts ? opts.delivery : DELIVERY),
  } as unknown as DeliveryContactGatewayPort;

  const links: TrackingLinkGatewayPort = {
    urlFor: jest.fn().mockResolvedValue({ token: 'tok', url: 'https://track.navix.pt/tok' }),
  };

  const registry: NotificationRegistryPort = {
    claim: jest.fn().mockResolvedValue(opts.claimed ?? true),
    isOptedOut: jest.fn().mockResolvedValue(opts.optedOut ?? false),
    optOut: jest.fn(),
  };

  const sent: { subject: string; body: string; destination: string }[] = [];
  const sender: NotificationSenderPort = {
    supports: (c) => c === 'email',
    send: jest.fn(async (n) => {
      if (opts.sendFails) throw new Error('provedor fora');
      sent.push({ subject: n.subject, body: n.body, destination: n.destination });
    }),
  };

  return {
    uc: new NotifyRecipientUseCase(config, deliveries, links, registry, sender),
    registry,
    links,
    sent,
  };
}

describe('NotifyRecipientUseCase', () => {
  it('envia e o corpo carrega o link de rastreio (growth loop)', async () => {
    const { uc, sent } = build();

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({ sent: true });

    expect(sent).toHaveLength(1);
    expect(sent[0].destination).toBe('ana@exemplo.test');
    expect(sent[0].body).toContain('https://track.navix.pt/tok');
    // E o endereço para sair — exigência de quem recebe e-mail não solicitado.
    expect(sent[0].body).toContain('optout=1');
  });

  it('desligado: não envia nada', async () => {
    const { uc, sent } = build({ enabled: false });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'desligado',
    });
    expect(sent).toHaveLength(0);
  });

  it('sem contato no canal: pula sem reservar o envio', async () => {
    const { uc, registry } = build({
      delivery: { ...DELIVERY, recipientEmail: null },
    });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'sem-contato',
    });
    expect(registry.claim).not.toHaveBeenCalled();
  });

  // Quem pediu para sair não recebe — e a verificação vem ANTES do claim, para
  // não gastar a reserva de um envio que não vai acontecer.
  it('opt-out: não envia e não reserva', async () => {
    const { uc, registry, sent } = build({ optedOut: true });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'opt-out',
    });
    expect(registry.claim).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('já enviado: o claim barra a repetição', async () => {
    const { uc, sent } = build({ claimed: false });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'ja-enviado',
    });
    expect(sent).toHaveLength(0);
  });

  it('canal sem adaptador (sms) é pulado explicitamente', async () => {
    const { uc } = build({ channel: 'sms' });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'canal-indisponivel',
    });
  });

  it('entrega inexistente (ou invisível pela RLS) não quebra', async () => {
    const { uc } = build({ delivery: null });

    await expect(uc.execute('t1', 'del-1', 'dispatched')).resolves.toEqual({
      sent: false,
      reason: 'entrega-inexistente',
    });
  });

  // Notificar é acessório: falhar no envio não pode derrubar quem publicou o
  // evento de domínio.
  it('falha do provedor não propaga', async () => {
    const { uc } = build({ sendFails: true });

    await expect(uc.execute('t1', 'del-1', 'delivered')).resolves.toEqual({
      sent: false,
      reason: 'canal-indisponivel',
    });
  });

  it('reusa o mesmo link nas várias notificações da entrega', async () => {
    const { uc, links } = build();

    await uc.execute('t1', 'del-1', 'dispatched');
    await uc.execute('t1', 'del-1', 'delivered');

    expect((links.urlFor as jest.Mock).mock.calls).toEqual([
      ['t1', 'del-1'],
      ['t1', 'del-1'],
    ]);
  });
});
