import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { CollectiveObservation } from '../../domain/collective-insight';
import type { CollectiveInsightsPort } from '../../domain/collective-insights.port';
import { CollectiveObservationOrmEntity } from './collective-observation.orm-entity';

/**
 * Repositório Postgres da inteligência coletiva (ADR-0031). Usa o repositório
 * escopado à transação do request (RLS por tenant).
 */
@Injectable()
export class CollectiveInsightsRepository implements CollectiveInsightsPort {
  constructor(
    @InjectRepository(CollectiveObservationOrmEntity)
    private readonly base: Repository<CollectiveObservationOrmEntity>,
  ) {}

  private get repo(): Repository<CollectiveObservationOrmEntity> {
    return scopedRepository(this.base);
  }

  async record(observation: CollectiveObservation): Promise<void> {
    const row = new CollectiveObservationOrmEntity();
    row.id = observation.id;
    row.tenantId = observation.tenantId;
    row.driverId = observation.driverId;
    row.cell = observation.cell;
    row.latitude = observation.latitude;
    row.longitude = observation.longitude;
    row.kind = observation.kind;
    row.parkingDifficulty = observation.parkingDifficulty;
    row.serviceMinutes = observation.serviceMinutes;
    row.accessTip = observation.accessTip;
    row.createdAt = observation.createdAt;
    await this.repo.save(row);
  }

  async findRecent(
    tenantId: string,
    cell: string,
    since: Date,
    limit: number,
  ): Promise<CollectiveObservation[]> {
    const rows = await this.repo.find({
      where: { tenantId, cell, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      driverId: r.driverId,
      cell: r.cell,
      latitude: r.latitude,
      longitude: r.longitude,
      kind: r.kind,
      parkingDifficulty: r.parkingDifficulty,
      serviceMinutes: r.serviceMinutes,
      accessTip: r.accessTip,
      createdAt: r.createdAt,
    }));
  }
}
