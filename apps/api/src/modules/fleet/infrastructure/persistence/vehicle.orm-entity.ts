import type { VehicleStatus, VehicleType } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'vehicles' })
@Index('uq_vehicles_tenant_plate', ['tenantId', 'plate'], { unique: true })
export class VehicleOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_vehicles_tenant')
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  plate!: string;

  @Column('text')
  type!: VehicleType;

  @Column('integer')
  capacity!: number;

  /** Capacidade de peso (kg) — ADR-0109. */
  @Column('double precision', { name: 'capacity_kg', nullable: true })
  capacityKg!: number | null;

  /** Capacidade de volume (m³) — ADR-0109. */
  @Column('double precision', { name: 'capacity_volume_m3', nullable: true })
  capacityVolumeM3!: number | null;

  @Column('text', { default: 'active' })
  status!: VehicleStatus;

  @Column('integer', { name: 'odometer_km', nullable: true })
  odometerKm!: number | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
