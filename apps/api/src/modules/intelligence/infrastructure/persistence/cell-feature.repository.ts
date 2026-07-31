import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { CellFeature, ServiceTimeSample } from '../../domain/cell-features';
import type { CellFeatureRepositoryPort } from '../../domain/ports/cell-feature-repository.port';
import { CellFeatureOrmEntity } from './cell-feature.orm-entity';
import { CollectiveObservationOrmEntity } from './collective-observation.orm-entity';

@Injectable()
export class CellFeatureRepository implements CellFeatureRepositoryPort {
  constructor(
    @InjectRepository(CellFeatureOrmEntity)
    private readonly base: Repository<CellFeatureOrmEntity>,
    @InjectRepository(CollectiveObservationOrmEntity)
    private readonly observations: Repository<CollectiveObservationOrmEntity>,
  ) {}

  private get repo(): Repository<CellFeatureOrmEntity> {
    return scopedRepository(this.base);
  }

  async samplesForCell(
    tenantId: string,
    cell: string,
    since: Date,
  ): Promise<ServiceTimeSample[]> {
    const rows = await scopedRepository(this.observations).find({
      // `source: 'derived'` é o filtro que mantém o corpus em quarentena fora
      // da feature (ADR-0088) — sem ele o tempo de ciclo voltaria pela porta
      // dos fundos.
      where: { tenantId, cell, kind: 'service_time', source: 'derived', createdAt: MoreThanOrEqual(since) },
      select: ['serviceMinutes', 'createdAt'],
    });

    return rows
      .filter((r) => r.serviceMinutes !== null)
      .map((r) => ({ minutes: r.serviceMinutes as number, at: r.createdAt }));
  }

  async replaceCell(tenantId: string, cell: string, features: CellFeature[]): Promise<void> {
    const repo = this.repo;
    await repo.delete({ tenantId, cell });
    if (features.length === 0) return;

    await repo.insert(
      features.map((f) => ({
        tenantId,
        cell: f.cell,
        bucket: f.bucket,
        samples: f.samples,
        serviceMinutesP50: f.serviceMinutesP50,
        updatedAt: new Date(),
      })),
    );
  }

  async findByCells(tenantId: string, cells: string[]): Promise<CellFeature[]> {
    if (cells.length === 0) return [];
    const rows = await this.repo.find({ where: { tenantId, cell: In(cells) } });
    return rows.map((r) => ({
      cell: r.cell,
      bucket: r.bucket,
      samples: r.samples,
      serviceMinutesP50: r.serviceMinutesP50,
    }));
  }
}
