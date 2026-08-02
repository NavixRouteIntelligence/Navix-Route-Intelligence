import type { Repository } from 'typeorm';

import type { AppConfigService } from '../../../shared/config/app-config.service';
import { WebhookSubscriptionOrmEntity } from '../infrastructure/persistence/webhook-subscription.orm-entity';

import { WebhookSecretCipher } from './webhook-secret-cipher';
import { WebhookSubscriptionService } from './webhook-subscription.service';

describe('WebhookSubscriptionService', () => {
  const inserted: WebhookSubscriptionOrmEntity[] = [];
  const repo = {
    create: (value: WebhookSubscriptionOrmEntity) => value,
    insert: async (value: WebhookSubscriptionOrmEntity) => void inserted.push(value),
  } as unknown as Repository<WebhookSubscriptionOrmEntity>;
  const config = {
    encryption: { kek: 'test-kek-with-at-least-32-characters' },
  } as AppConfigService;
  const service = new WebhookSubscriptionService(repo, new WebhookSecretCipher(config));

  beforeEach(() => inserted.splice(0));

  it('devolve o segredo uma vez e persiste apenas a versão cifrada', async () => {
    const result = await service.create({
      tenantId: 'tenant-1',
      name: 'ERP',
      url: 'https://erp.example.com/navix',
      events: ['delivery.created'],
    });
    expect(result.signingSecret).toMatch(/^whsec_/);
    expect(inserted[0].encryptedSecret).not.toContain(result.signingSecret);
  });

  it.each([
    'http://example.com/hook',
    'https://localhost/hook',
    'https://localhost./hook',
    'https://192.168.1.20/hook',
    'https://[::1]/hook',
    'https://user:pass@example.com/hook',
  ])('bloqueia destino inseguro: %s', async (url) => {
    await expect(
      service.create({ tenantId: 'tenant-1', name: 'bad', url, events: ['delivery.created'] }),
    ).rejects.toThrow();
  });
});
