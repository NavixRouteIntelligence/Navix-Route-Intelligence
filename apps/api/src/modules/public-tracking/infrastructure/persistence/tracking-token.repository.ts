import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type {
  TrackingTokenRef,
  TrackingTokenRepositoryPort,
} from '../../domain/ports/tracking-token-repository.port';
import { DeliveryTrackingTokenOrmEntity } from './delivery-tracking-token.orm-entity';

/**
 * Repositório dos tokens públicos (ADR-0082).
 *
 * `resolve` roda **fora** de transação de tenant (o request público não tem
 * uma): o `scopedRepository` cai no pool padrão nesse caso. É seguro porque a
 * tabela não tem RLS **e** não guarda PII — ver a migração.
 */
@Injectable()
export class TrackingTokenRepository implements TrackingTokenRepositoryPort {
  constructor(
    @InjectRepository(DeliveryTrackingTokenOrmEntity)
    private readonly base: Repository<DeliveryTrackingTokenOrmEntity>,
  ) {}

  async resolve(token: string): Promise<TrackingTokenRef | null> {
    const row = await this.base.findOne({
      where: { token, revokedAt: IsNull() },
      select: ['deliveryId', 'tenantId'],
    });
    return row ? { deliveryId: row.deliveryId, tenantId: row.tenantId } : null;
  }

  async findActiveByDelivery(tenantId: string, deliveryId: string): Promise<string | null> {
    const row = await scopedRepository(this.base).findOne({
      where: { tenantId, deliveryId, revokedAt: IsNull() },
      select: ['token'],
    });
    return row?.token ?? null;
  }

  async issue(token: string, tenantId: string, deliveryId: string): Promise<void> {
    await scopedRepository(this.base).insert({
      token,
      tenantId,
      deliveryId,
      createdAt: new Date(),
      revokedAt: null,
    });
  }
}
