import type { TrackingStatus } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'driver_positions' })
@Index('idx_driver_positions_tenant_driver_time', ['tenantId', 'driverId', 'recordedAt'])
export class DriverPositionOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'driver_id' })
  driverId!: string;

  @Column('double precision')
  latitude!: number;

  @Column('double precision')
  longitude!: number;

  @Column('double precision', { nullable: true })
  speed!: number | null;

  @Column('double precision', { nullable: true })
  heading!: number | null;

  @Column('text', { default: 'en_route' })
  status!: TrackingStatus;

  @Column('timestamptz', { name: 'recorded_at' })
  recordedAt!: Date;
}
