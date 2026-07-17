import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type {
  OptimizationJobRecord,
  OptimizationJobRepositoryPort,
  OptimizationJobUpdate,
} from '../../domain/ports/optimization-job-repository.port';
import { OptimizationJobOrmEntity } from './optimization-job.orm-entity';

/** Repositório TypeORM de jobs de otimização (escopo de tenant via RLS). */
@Injectable()
export class OptimizationJobRepository implements OptimizationJobRepositoryPort {
  constructor(
    @InjectRepository(OptimizationJobOrmEntity)
    private readonly base: Repository<OptimizationJobOrmEntity>,
  ) {}

  private get repo(): Repository<OptimizationJobOrmEntity> {
    return scopedRepository(this.base);
  }

  async create(record: Omit<OptimizationJobRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    await this.repo.save(
      this.repo.create({
        id: record.id,
        tenantId: record.tenantId,
        status: record.status,
        request: record.request,
        routePlanId: record.routePlanId,
        error: record.error,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async findById(tenantId: string, id: string): Promise<OptimizationJobRecord | null> {
    const row = await this.repo
      .createQueryBuilder('j')
      .where('j.tenant_id = :tenantId', { tenantId })
      .andWhere('j.id = :id', { id })
      .getOne();
    return row ? { ...row } : null;
  }

  async update(id: string, patch: OptimizationJobUpdate): Promise<void> {
    await this.repo.update(
      { id },
      {
        status: patch.status,
        ...(patch.routePlanId !== undefined ? { routePlanId: patch.routePlanId } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        updatedAt: new Date(),
      },
    );
  }

  async claim(id: string): Promise<boolean> {
    // UPDATE ... WHERE id = $1 AND status = 'queued' — só um consumidor vence.
    const result = await this.repo.update(
      { id, status: 'queued' },
      { status: 'running', updatedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async resetForRetry(id: string): Promise<boolean> {
    // Só reseta o que ficou preso em `running` (worker morto). Jobs terminais
    // (succeeded/failed) e ainda-queued não são afetados.
    const result = await this.repo.update(
      { id, status: 'running' },
      { status: 'queued', updatedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }
}
