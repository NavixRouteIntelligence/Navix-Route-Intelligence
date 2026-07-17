import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { DriverPosition } from '../../domain/driver-position';
import type { PositionRepositoryPort } from '../../domain/ports/position-repository.port';
import { DriverPositionOrmEntity } from './driver-position.orm-entity';

/** Fração das escritas que dispara o expurgo amortizado (~1 a cada 50). */
const PRUNE_SAMPLE_RATE = 0.02;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PositionRepository implements PositionRepositoryPort {
  private readonly logger = new Logger('PositionRepository');
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(DriverPositionOrmEntity)
    private readonly base: Repository<DriverPositionOrmEntity>,
    config: AppConfigService,
  ) {
    this.retentionDays = config.tracking.retentionDays;
  }

  private get repo(): Repository<DriverPositionOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(position: DriverPosition): Promise<void> {
    await this.repo.insert(this.toRow(position));
    await this.maybePrune(position.tenantId);
  }

  async saveMany(positions: DriverPosition[]): Promise<void> {
    if (positions.length === 0) return;
    // Um único INSERT multi-linha (append-only de série temporal).
    await this.repo.insert(positions.map((p) => this.toRow(p)));
    await this.maybePrune(positions[0].tenantId);
  }

  async pruneOlderThan(tenantId: string, olderThan: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(DriverPositionOrmEntity)
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('recorded_at < :olderThan', { olderThan })
      .execute();
    return result.affected ?? 0;
  }

  /**
   * Expurgo **amortizado**: numa fração das escritas, remove as posições do
   * próprio tenant fora da janela de retenção (ADR-0048). Best-effort — uma
   * falha aqui nunca derruba a gravação da posição.
   */
  private async maybePrune(tenantId: string): Promise<void> {
    if (this.retentionDays <= 0) return;
    if (Math.random() >= PRUNE_SAMPLE_RATE) return;
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
      const removed = await this.pruneOlderThan(tenantId, cutoff);
      if (removed > 0) this.logger.log(`Retenção: ${removed} posições expurgadas.`);
    } catch (err) {
      this.logger.warn(`Expurgo de posições falhou: ${err instanceof Error ? err.message : err}`);
    }
  }

  private toRow(position: DriverPosition): DriverPositionOrmEntity {
    const row = new DriverPositionOrmEntity();
    row.id = position.id;
    row.tenantId = position.tenantId;
    row.driverId = position.driverId;
    row.latitude = position.latitude;
    row.longitude = position.longitude;
    row.speed = position.speed;
    row.heading = position.heading;
    row.status = position.status;
    row.recordedAt = position.recordedAt;
    return row;
  }

  async findLatestForDriver(tenantId: string, driverId: string): Promise<DriverPosition | null> {
    const row = await this.repo.findOne({
      where: { tenantId, driverId },
      order: { recordedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  /** Última posição por motorista (DISTINCT ON, específico do PostgreSQL). */
  async findLatestPerDriver(tenantId: string): Promise<DriverPosition[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .distinctOn(['p.driver_id'])
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.driver_id')
      .addOrderBy('p.recorded_at', 'DESC')
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async findHistory(tenantId: string, driverId: string, limit: number): Promise<DriverPosition[]> {
    const rows = await this.repo.find({
      where: { tenantId, driverId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: DriverPositionOrmEntity): DriverPosition {
    return {
      id: row.id,
      tenantId: row.tenantId,
      driverId: row.driverId,
      latitude: row.latitude,
      longitude: row.longitude,
      recordedAt: row.recordedAt,
      speed: row.speed,
      heading: row.heading,
      status: row.status,
    };
  }
}
