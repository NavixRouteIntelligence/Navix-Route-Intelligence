import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EXTERNAL_EVENT_OUTBOX } from '../../shared/events/external-event-outbox.port';

import { WebhookDispatcher } from './application/webhook-dispatcher';
import { WebhookHttpClient } from './application/webhook-http.client';
import { WebhookOutboxService } from './application/webhook-outbox.service';
import { WebhookSecretCipher } from './application/webhook-secret-cipher';
import { WebhookSubscriptionService } from './application/webhook-subscription.service';
import { WebhookDeliveryOrmEntity } from './infrastructure/persistence/webhook-delivery.orm-entity';
import { WebhookSubscriptionOrmEntity } from './infrastructure/persistence/webhook-subscription.orm-entity';
import { WebhookController } from './interface/webhook.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WebhookSubscriptionOrmEntity, WebhookDeliveryOrmEntity])],
  controllers: [WebhookController],
  providers: [
    WebhookSecretCipher,
    WebhookSubscriptionService,
    WebhookOutboxService,
    WebhookDispatcher,
    WebhookHttpClient,
    { provide: EXTERNAL_EVENT_OUTBOX, useExisting: WebhookOutboxService },
  ],
  exports: [EXTERNAL_EVENT_OUTBOX, WebhookSubscriptionService],
})
export class WebhooksModule {}
