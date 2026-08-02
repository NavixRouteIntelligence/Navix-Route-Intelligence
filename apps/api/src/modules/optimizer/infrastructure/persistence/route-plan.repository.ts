import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { RoutePlanRepositoryPort } from '../../domain/ports/route-plan-repository.port';
import { RoutePlan } from '../../domain/route-plan';
import { RoutePlanOrmEntity } from './route-plan.orm-entity';

/** Repositório TypeORM de route plans. Escopo via transação (RLS) + tenant. */
@Injectable()
export class RoutePlanRepository implements RoutePlanRepositoryPort {
  constructor(
    @InjectRepository(RoutePlanOrmEntity)
    private readonly base: Repository<RoutePlanOrmEntity>,
  ) {}

  private get repo(): Repository<RoutePlanOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(plan: RoutePlan): Promise<void> {
    const s = plan.snapshot();
    const row = new RoutePlanOrmEntity();
    row.id = s.id;
    row.tenantId = s.tenantId;
    row.driverId = s.driverId;
    row.operationalDay = s.operationalDay;
    row.strategy = s.strategy;
    row.status = s.status;
    row.params = s.params;
    row.stops = s.stops;
    row.metrics = s.metrics;
    row.baseline = s.baseline;
    row.savings = s.savings;
    row.score = s.score;
    row.explanation = s.explanation;
    row.capacity = s.capacity ?? null;
    row.routes = s.routes ?? null;
    row.unassignedStops = s.unassignedStops ?? null;
    row.createdAt = s.createdAt;
    await this.repo.save(row);
  }

  async findById(tenantId: string, id: string): Promise<RoutePlan | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(tenantId: string, page: PageParams): Promise<PagedResult<RoutePlan>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async findActiveForDriver(
    tenantId: string,
    driverId: string | null,
    operationalDay: string,
  ): Promise<RoutePlan | null> {
    const row = await this.repo.findOne({
      // `IsNull()` e não `driverId: null`: o TypeORM traduz `null` literal para
      // `= NULL`, que nunca casa, e a rota do autônomo simplesmente sumiria.
      where: { tenantId, driverId: driverId ?? IsNull(), operationalDay },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: RoutePlanOrmEntity): RoutePlan {
    return RoutePlan.restore({
      id: row.id,
      tenantId: row.tenantId,
      driverId: row.driverId,
      operationalDay: row.operationalDay,
      strategy: row.strategy,
      status: row.status,
      params: row.params,
      stops: row.stops,
      metrics: row.metrics,
      baseline: row.baseline,
      savings: row.savings,
      score: row.score,
      explanation: row.explanation,
      capacity: row.capacity ?? undefined,
      routes: row.routes ?? undefined,
      unassignedStops: row.unassignedStops ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
