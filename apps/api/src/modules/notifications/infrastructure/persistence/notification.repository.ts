import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { NotificationChannel, NotificationEvent } from '../../domain/notification-event';
import type { NotificationRegistryPort } from '../../domain/ports/notification-registry.port';

/**
 * Guarda o destino **hasheado**: o log serve para não repetir envio e para
 * auditar, e nenhum desses usos precisa do e-mail em claro. O opt-out, esse
 * sim, precisa comparar com o endereço recebido — então guarda o valor, que é
 * protegido pela RLS como qualquer outro dado de tenant.
 */
const hashDestination = (value: string): string =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

@Injectable()
export class NotificationRepository implements NotificationRegistryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Usa a transação do request quando há uma; senão, o pool. */
  private get manager() {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async claim(input: {
    tenantId: string;
    deliveryId: string;
    event: NotificationEvent;
    channel: NotificationChannel;
    destination: string;
  }): Promise<boolean> {
    // `ON CONFLICT DO NOTHING` sobre o índice único (delivery_id, event): quem
    // inserir ganha, os demais recebem 0 linhas. A exclusão mútua fica no banco,
    // então continua valendo entre processos (API e worker).
    const rows: unknown[] = await this.manager.query(
      `INSERT INTO notification_log (id, tenant_id, delivery_id, event, channel, destination_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (delivery_id, event) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        input.tenantId,
        input.deliveryId,
        input.event,
        input.channel,
        hashDestination(input.destination),
      ],
    );
    return rows.length > 0;
  }

  async isOptedOut(
    tenantId: string,
    channel: NotificationChannel,
    destination: string,
  ): Promise<boolean> {
    const rows: unknown[] = await this.manager.query(
      `SELECT 1 FROM notification_opt_outs
        WHERE tenant_id = $1 AND channel = $2 AND destination = $3
        LIMIT 1`,
      [tenantId, channel, destination.trim().toLowerCase()],
    );
    return rows.length > 0;
  }

  async optOut(
    tenantId: string,
    channel: NotificationChannel,
    destination: string,
  ): Promise<void> {
    // Idempotente: pedir duas vezes para sair não é erro.
    await this.manager.query(
      `INSERT INTO notification_opt_outs (id, tenant_id, channel, destination)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, channel, destination) DO NOTHING`,
      [randomUUID(), tenantId, channel, destination.trim().toLowerCase()],
    );
  }
}
