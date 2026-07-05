import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import type { RoutePlanRepositoryPort } from '../../domain/ports/route-plan-repository.port';
import { RoutePlan } from '../../domain/route-plan';
import { RoutePlanOrmEntity } from './route-plan.orm-entity';

/** Repositório TypeORM de route plans. Escopado por tenant. */
@Injectable()
export class RoutePlanRepository implements RoutePlanRepositoryPort {
  constructor(
    @InjectRepository(RoutePlanOrmEntity)
    private readonly repo: Repository<RoutePlanOrmEntity>,
  ) {}

  async save(plan: RoutePlan): Promise<void> {
    const s = plan.snapshot();
    const row = new RoutePlanOrmEntity();
    row.id = s.id;
    row.tenantId = s.tenantId;
    row.strategy = s.strategy;
    row.status = s.status;
    row.params = s.params;
    row.stops = s.stops;
    row.metrics = s.metrics;
    row.baseline = s.baseline;
    row.savings = s.savings;
    row.score = s.score;
    row.explanation = s.explanation;
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

  private toDomain(row: RoutePlanOrmEntity): RoutePlan {
    return RoutePlan.restore({
      id: row.id,
      tenantId: row.tenantId,
      strategy: row.strategy,
      status: row.status,
      params: row.params,
      stops: row.stops,
      metrics: row.metrics,
      baseline: row.baseline,
      savings: row.savings,
      score: row.score,
      explanation: row.explanation,
      createdAt: row.createdAt,
    });
  }
}
