import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RoutePlanParams,
  RouteSavings,
  RouteStopView,
  VehicleRouteView,
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

  /** Uso de capacidade vs. veículo (ADR-0022). Null sem veículo/demanda. */
  @Column('jsonb', { nullable: true })
  capacity!: CapacityUsage | null;

  /** Rotas por veículo (ADR-0022, Fase 2). Null no plano de veículo único. */
  @Column('jsonb', { nullable: true })
  routes!: VehicleRouteView[] | null;

  /** Paradas não atribuídas por capacidade (ADR-0022, Fase 2). */
  @Column('jsonb', { name: 'unassigned_stops', nullable: true })
  unassignedStops!: string[] | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
