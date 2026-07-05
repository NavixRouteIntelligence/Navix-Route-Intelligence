import type {
  OptimizationStrategyName,
  RouteMetrics,
  RoutePlanParams,
  RouteSavings,
  RouteStopView,
} from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Mapeamento da tabela `route_plans`. A sequência e as métricas são guardadas
 * como JSONB (MVP single-vehicle); a normalização em routes/route_stops fica
 * como evolução futura (ver docs/database.md §4).
 */
@Entity({ name: 'route_plans' })
@Index('idx_route_plans_tenant_created', ['tenantId', 'createdAt'])
export class RoutePlanOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  strategy!: OptimizationStrategyName;

  @Column('text', { default: 'completed' })
  status!: 'completed';

  @Column('jsonb')
  params!: RoutePlanParams;

  @Column('jsonb')
  stops!: RouteStopView[];

  @Column('jsonb')
  metrics!: RouteMetrics;

  @Column('jsonb')
  baseline!: RouteMetrics;

  @Column('jsonb')
  savings!: RouteSavings;

  @Column('integer')
  score!: number;

  @Column('text')
  explanation!: string;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
