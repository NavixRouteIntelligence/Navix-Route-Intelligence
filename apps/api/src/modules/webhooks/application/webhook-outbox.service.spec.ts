import type { Repository } from 'typeorm';

import { WebhookDeliveryOrmEntity } from '../infrastructure/persistence/webhook-delivery.orm-entity';
import { WebhookSubscriptionOrmEntity } from '../infrastructure/persistence/webhook-subscription.orm-entity';

import { WebhookOutboxService } from './webhook-outbox.service';

describe('WebhookOutboxService', () => {
  it('cria uma entrega de outbox para cada assinatura do evento', async () => {
    const subscriptions = {
      createQueryBuilder: () => ({
        where: () => ({
          andWhere: () => ({
            andWhere: () => ({
              getMany: async () => [
                { id: '11111111-1111-1111-1111-111111111111' },
                { id: '22222222-2222-2222-2222-222222222222' },
              ],
            }),
          }),
        }),
      }),
    } as unknown as Repository<WebhookSubscriptionOrmEntity>;
    const saved: WebhookDeliveryOrmEntity[] = [];
    const deliveries = {
      create: (value: WebhookDeliveryOrmEntity) => value,
      save: async (rows: WebhookDeliveryOrmEntity[]) => void saved.push(...rows),
    } as unknown as Repository<WebhookDeliveryOrmEntity>;
    const service = new WebhookOutboxService(subscriptions, deliveries);

    await service.record({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      type: 'delivery.created',
      aggregateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      payload: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    });

    expect(saved).toHaveLength(2);
    expect(saved.every((row) => row.status === 'pending')).toBe(true);
    expect(saved.every((row) => row.tenantId === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(
      true,
    );
  });
});
