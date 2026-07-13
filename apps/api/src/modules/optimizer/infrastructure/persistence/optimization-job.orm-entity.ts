import type { OptimizationJobStatus } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { OptimizationJobRequest } from '../../domain/ports/optimization-job-repository.port';

/** Mapeamento da tabela `optimization_jobs` (ADR-0007). */
@Entity({ name: 'optimization_jobs' })
@Index('idx_optimization_jobs_tenant_created', ['tenantId', 'createdAt'])
export class OptimizationJobOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  status!: OptimizationJobStatus;

  @Column('jsonb')
  request!: OptimizationJobRequest;

  @Column('uuid', { name: 'route_plan_id', nullable: true })
  routePlanId!: string | null;

  @Column('text', { nullable: true })
  error!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
