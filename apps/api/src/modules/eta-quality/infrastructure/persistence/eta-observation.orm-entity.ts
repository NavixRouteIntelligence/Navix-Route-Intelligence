import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { EtaActualSource } from '../../domain/eta-observation';

/** Mapeamento ORM de `eta_observations` (ADR-0087). Escopada por tenant (RLS). */
@Entity({ name: 'eta_observations' })
@Index('idx_eta_observations_tenant_created', ['tenantId', 'createdAt'])
export class EtaObservationOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'delivery_id' })
  deliveryId!: string;

  @Column('uuid', { name: 'route_plan_id', nullable: true })
  routePlanId!: string | null;

  @Column('timestamptz', { name: 'predicted_arrival_at', nullable: true })
  predictedArrivalAt!: Date | null;

  @Column('timestamptz', { name: 'actual_arrival_at' })
  actualArrivalAt!: Date;

  @Column('double precision', { name: 'error_minutes', nullable: true })
  errorMinutes!: number | null;

  @Column('text')
  source!: EtaActualSource;

  @Column('text')
  cell!: string;

  @Column('smallint', { name: 'hour_of_week' })
  hourOfWeek!: number;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
