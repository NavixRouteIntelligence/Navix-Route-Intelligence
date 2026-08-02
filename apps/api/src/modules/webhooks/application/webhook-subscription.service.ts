import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../shared/database/transaction-context';
import { NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { PUBLIC_WEBHOOK_EVENTS, type PublicWebhookEvent } from '../../public-api/domain/public-api';
import { WebhookSubscriptionOrmEntity } from '../infrastructure/persistence/webhook-subscription.orm-entity';

import { WebhookSecretCipher } from './webhook-secret-cipher';
import { isUnsafeWebhookHostname } from './webhook-url-security';

export interface WebhookSubscriptionView {
  id: string;
  name: string;
  url: string;
  events: PublicWebhookEvent[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WebhookSubscriptionService {
  constructor(
    @InjectRepository(WebhookSubscriptionOrmEntity)
    private readonly base: Repository<WebhookSubscriptionOrmEntity>,
    private readonly cipher: WebhookSecretCipher,
  ) {}

  async create(input: {
    tenantId: string;
    name: string;
    url: string;
    events: PublicWebhookEvent[];
  }): Promise<WebhookSubscriptionView & { signingSecret: string }> {
    this.assertSafeUrl(input.url);
    if (
      input.events.length === 0 ||
      !input.events.every((event) => PUBLIC_WEBHOOK_EVENTS.includes(event))
    ) {
      throw new ValidationError('Selecione eventos de webhook válidos.');
    }
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    const row = this.base.create({
      id: newId(),
      tenantId: input.tenantId,
      name: input.name,
      url: input.url,
      events: [...new Set(input.events)],
      encryptedSecret: this.cipher.encrypt(secret),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await scopedRepository(this.base).insert(row);
    return { ...this.toView(row), signingSecret: secret };
  }

  async list(tenantId: string): Promise<WebhookSubscriptionView[]> {
    const rows = await scopedRepository(this.base).find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; url?: string; events?: PublicWebhookEvent[]; enabled?: boolean },
  ): Promise<WebhookSubscriptionView> {
    if (input.url) this.assertSafeUrl(input.url);
    if (
      input.events &&
      (input.events.length === 0 ||
        !input.events.every((event) => PUBLIC_WEBHOOK_EVENTS.includes(event)))
    ) {
      throw new ValidationError('Selecione eventos de webhook válidos.');
    }
    const repo = scopedRepository(this.base);
    const row = await repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundError('Webhook não encontrado.');
    if (input.name !== undefined) row.name = input.name;
    if (input.url !== undefined) row.url = input.url;
    if (input.events !== undefined) row.events = [...new Set(input.events)];
    if (input.enabled !== undefined) row.enabled = input.enabled;
    row.updatedAt = new Date();
    await repo.save(row);
    return this.toView(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await scopedRepository(this.base).delete({ tenantId, id });
    if (!result.affected) throw new NotFoundError('Webhook não encontrado.');
  }

  private assertSafeUrl(raw: string): void {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new ValidationError('URL de webhook inválida.');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      isUnsafeWebhookHostname(url.hostname)
    ) {
      throw new ValidationError(
        'O webhook deve usar HTTPS público, sem credenciais nem endereço privado.',
      );
    }
  }

  private toView(row: WebhookSubscriptionOrmEntity): WebhookSubscriptionView {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      events: row.events as PublicWebhookEvent[],
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
