import { createHmac } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { transactionContext } from '../../../shared/database/transaction-context';

import { WebhookHttpClient } from './webhook-http.client';
import { WebhookSecretCipher } from './webhook-secret-cipher';

interface ClaimedDelivery {
  id: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  url: string;
  encryptedSecret: string;
}

@Injectable()
export class WebhookDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private static readonly MAX_ATTEMPTS = 6;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cipher: WebhookSecretCipher,
    private readonly http: WebhookHttpClient,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let count = 0; count < 20; count++) {
        const delivery = await this.claim();
        if (!delivery) break;
        await this.deliver(delivery);
      }
    } catch (error) {
      this.logger.warn(
        `Falha no ciclo de webhooks: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<ClaimedDelivery | null> {
    const rows = (await this.dataSource.query(`
      SELECT id::text,
             tenant_id::text AS "tenantId",
             event_type AS "eventType",
             payload,
             attempts,
             url,
             encrypted_secret AS "encryptedSecret"
        FROM claim_webhook_delivery()
    `)) as ClaimedDelivery[];
    return rows[0] ?? null;
  }

  private async deliver(delivery: ClaimedDelivery): Promise<void> {
    let status: number | null = null;
    let error: string | null = null;
    try {
      const body = JSON.stringify({
        id: delivery.id,
        type: delivery.eventType,
        createdAt: new Date().toISOString(),
        data: delivery.payload,
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = this.cipher.decrypt(delivery.encryptedSecret);
      const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
      status = await this.http.post(delivery.url, body, {
        'content-type': 'application/json',
        'user-agent': 'Navix-Webhooks/1.0',
        'x-navix-event': delivery.eventType,
        'x-navix-delivery': delivery.id,
        'x-navix-timestamp': timestamp,
        'x-navix-signature': `v1=${signature}`,
      });
      if (status < 200 || status >= 300) error = `Endpoint respondeu HTTP ${status}.`;
    } catch (reason) {
      error = reason instanceof Error ? reason.message.slice(0, 500) : String(reason).slice(0, 500);
    }

    await this.withTenant(delivery.tenantId, async (manager) => {
      if (!error) {
        await manager.query(
          `UPDATE webhook_deliveries SET status='delivered', delivered_at=now(), response_status=$2, last_error=NULL WHERE id=$1`,
          [delivery.id, status],
        );
        return;
      }
      const dead = delivery.attempts >= WebhookDispatcher.MAX_ATTEMPTS;
      const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, delivery.attempts - 1));
      await manager.query(
        `
        UPDATE webhook_deliveries
           SET status=$2, response_status=$3, last_error=$4,
               next_attempt_at=now() + ($5 * interval '1 second')
         WHERE id=$1
      `,
        [delivery.id, dead ? 'dead' : 'pending', status, error, delaySeconds],
      );
    });
  }

  private withTenant<T>(tenantId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, () => fn(manager));
    });
  }
}
