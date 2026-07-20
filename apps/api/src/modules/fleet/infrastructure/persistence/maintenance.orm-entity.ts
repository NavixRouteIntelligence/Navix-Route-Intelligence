import type { MaintenanceType } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'vehicle_maintenance' })
@Index('idx_vehicle_maintenance_vehicle', ['tenantId', 'vehicleId', 'performedAt'])
export class MaintenanceOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'vehicle_id' })
  vehicleId!: string;

  @Column('text')
  type!: MaintenanceType;

  @Column('date', { name: 'performed_at' })
  performedAt!: string; // date column → 'YYYY-MM-DD'

  @Column('integer', { name: 'odometer_km', nullable: true })
  odometerKm!: number | null;

  @Column('integer', { name: 'cost_cents', nullable: true })
  costCents!: number | null;

  @Column('text', { nullable: true })
  notes!: string | null;

  @Column('date', { name: 'next_due_date', nullable: true })
  nextDueDate!: string | null;

  @Column('integer', { name: 'next_due_odometer_km', nullable: true })
  nextDueOdometerKm!: number | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
