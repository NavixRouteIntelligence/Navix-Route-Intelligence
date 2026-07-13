import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { DriverPosition } from '../../domain/driver-position';
import type { PositionRepositoryPort } from '../../domain/ports/position-repository.port';
import { DriverPositionOrmEntity } from './driver-position.orm-entity';

@Injectable()
export class PositionRepository implements PositionRepositoryPort {
  constructor(
    @InjectRepository(DriverPositionOrmEntity)
    private readonly base: Repository<DriverPositionOrmEntity>,
  ) {}

  private get repo(): Repository<DriverPositionOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(position: DriverPosition): Promise<void> {
    await this.repo.insert(this.toRow(position));
  }

  async saveMany(positions: DriverPosition[]): Promise<void> {
    if (positions.length === 0) return;
    // Um único INSERT multi-linha (append-only de série temporal).
    await this.repo.insert(positions.map((p) => this.toRow(p)));
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
