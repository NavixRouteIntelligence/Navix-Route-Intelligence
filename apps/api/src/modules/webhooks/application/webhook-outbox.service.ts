import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../shared/database/transaction-context';
import type {
  ExternalEventInput,
  ExternalEventOutboxPort,
} from '../../../shared/events/external-event-outbox.port';
import { newId } from '../../../shared/kernel/id';
import { WebhookDeliveryOrmEntity } from '../infrastructure/persistence/webhook-delivery.orm-entity';
import { WebhookSubscriptionOrmEntity } from '../infrastructure/persistence/webhook-subscription.orm-entity';

@Injectable()
export class WebhookOutboxService implements ExternalEventOutboxPort {
  constructor(
    @InjectRepository(WebhookSubscriptionOrmEntity)
    private readonly subscriptions: Repository<WebhookSubscriptionOrmEntity>,
    @InjectRepository(WebhookDeliveryOrmEntity)
    private readonly deliveries: Repository<WebhookDeliveryOrmEntity>,
  ) {}

  async record(input: ExternalEventInput): Promise<void> {
    const subscriptions = await scopedRepository(this.subscriptions)
      .createQueryBuilder('subscription')
      .where('subscription.tenant_id = :tenantId', { tenantId: input.tenantId })
      .andWhere('subscription.enabled = true')
      .andWhere(':event = ANY(subscription.events)', { event: input.type })
      .getMany();
    if (subscriptions.length === 0) return;
    const now = new Date();
    const rows = subscriptions.map((subscription) =>
      this.deliveries.create({
        id: newId(),
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        eventType: input.type,
        aggregateId: input.aggregateId,
        payload: input.payload,
        status: 'pending' as const,
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        responseStatus: null,
        createdAt: now,
        deliveredAt: null,
      }),
    );
    await scopedRepository(this.deliveries).save(rows);
  }
}
