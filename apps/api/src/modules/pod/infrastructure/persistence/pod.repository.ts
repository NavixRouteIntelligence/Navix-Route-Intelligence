import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { ProofOfDelivery } from '../../domain/proof-of-delivery';
import type { PodRepositoryPort } from '../../domain/ports/pod-repository.port';
import { PodOrmEntity } from './pod.orm-entity';

@Injectable()
export class PodRepository implements PodRepositoryPort {
  constructor(
    @InjectRepository(PodOrmEntity)
    private readonly base: Repository<PodOrmEntity>,
  ) {}

  private get repo(): Repository<PodOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(pod: ProofOfDelivery): Promise<void> {
    const row = new PodOrmEntity();
    row.id = pod.id;
    row.tenantId = pod.tenantId;
    row.deliveryId = pod.deliveryId;
    row.driverId = pod.driverId;
    row.status = pod.status;
    row.note = pod.note;
    row.latitude = pod.latitude;
    row.longitude = pod.longitude;
    row.photo = pod.photo;
    row.signature = pod.signature;
    row.recordedAt = pod.recordedAt;
    await this.repo.save(row);
  }

  async findByDelivery(tenantId: string, deliveryId: string): Promise<ProofOfDelivery | null> {
    const row = await this.repo.findOne({ where: { tenantId, deliveryId } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(tenantId: string, page: PageParams): Promise<PagedResult<ProofOfDelivery>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { recordedAt: 'DESC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async countByStatus(tenantId: string): Promise<{ delivered: number; absent: number; refused: number }> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenant_id = :tenantId', { tenantId })
      .groupBy('p.status')
      .getRawMany<{ status: string; count: string }>();
    const acc = { delivered: 0, absent: 0, refused: 0 };
    for (const r of rows) {
      if (r.status in acc) acc[r.status as keyof typeof acc] = Number(r.count);
    }
    return acc;
  }

  private toDomain(row: PodOrmEntity): ProofOfDelivery {
    return {
      id: row.id,
      tenantId: row.tenantId,
      deliveryId: row.deliveryId,
      driverId: row.driverId,
      status: row.status,
      note: row.note,
      latitude: row.latitude,
      longitude: row.longitude,
      photo: row.photo,
      signature: row.signature,
      recordedAt: row.recordedAt,
    };
  }
}
