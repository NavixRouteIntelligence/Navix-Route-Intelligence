import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RoutePlanParams,
  RouteSavings,
  RouteStopView,
  UnreachableStopView,
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
@Index('idx_route_plans_driver_day', ['tenantId', 'driverId', 'operationalDay'])
export class RoutePlanOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  /** Ficha do motorista dono da rota (ADR-0098). Null: autônomo ou plano de frota. */
  @Column('uuid', { name: 'driver_id', nullable: true })
  driverId!: string | null;

  /** Dia operacional (`YYYY-MM-DD`). `date` volta como string do driver. */
  @Column('date', { name: 'operational_day' })
  operationalDay!: string;

  /** Quando a otimização foi **pedida** (ADR-0103). Decide quem substitui quem. */
  @Column('timestamptz', { name: 'requested_at' })
  requestedAt!: Date;

  /** Minuto zero da rota (ADR-0105): a âncora de todo ETA do plano. */
  @Column('timestamptz', { name: 'departure_at' })
  departureAt!: Date;

  /** É a rota de um motorista no dia — uma só. `false` no plano do despacho. */
  @Column('boolean', { name: 'driver_scoped', default: false })
  driverScoped!: boolean;

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

  /** Paradas sem trecho viável (ADR-0106). Null quando a rota cobriu todas. */
  @Column('jsonb', { name: 'unreachable_stops', nullable: true })
  unreachableStops!: UnreachableStopView[] | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
