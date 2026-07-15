import type { ObservationKind, ParkingDifficulty } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Observação de campo da inteligência coletiva (ADR-0031). Escopada por tenant
 * (RLS). Índice por (tenant, cell, created_at) para a consulta de agregação.
 */
@Entity({ name: 'collective_observations' })
@Index('idx_collective_cell', ['tenantId', 'cell', 'createdAt'])
export class CollectiveObservationOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'driver_id' })
  driverId!: string;

  @Column('text')
  cell!: string;

  @Column('double precision')
  latitude!: number;

  @Column('double precision')
  longitude!: number;

  @Column('text')
  kind!: ObservationKind;

  @Column('text', { name: 'parking_difficulty', nullable: true })
  parkingDifficulty!: ParkingDifficulty | null;

  @Column('double precision', { name: 'service_minutes', nullable: true })
  serviceMinutes!: number | null;

  @Column('text', { name: 'access_tip', nullable: true })
  accessTip!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
